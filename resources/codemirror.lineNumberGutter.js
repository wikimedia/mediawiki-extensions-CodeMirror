/**
 * Offsets above and below the viewport, so numbers are ready before their lines scroll in.
 *
 * @type {number}
 * @private
 */
const VIEWPORT_PADDING = 100;

/**
 * Line-number gutter for a VisualEditor source-mode surface, drawn beside VisualEditor's own
 * paragraphs: the custom-highlight controller has no EditorView to host CodeMirror's gutter.
 * Uses only public VE API, so it needs no support in VE core.
 *
 * In source mode each line is its own paragraph (ve.dm.SourceConverter), so a line's number is
 * its index in the document node. Bounded to the viewport, so long documents stay cheap.
 *
 * Inert until {@link CodeMirrorLineNumberGutter#setEnabled} is called.
 */
class CodeMirrorLineNumberGutter {
	/**
	 * @param {ve.ce.Surface} surfaceView
	 * @param {Function} [formatNumber] ( number ) => string, e.g. for localised digits
	 */
	constructor( surfaceView, formatNumber ) {
		/**
		 * @type {ve.ce.Surface|null} Null once destroyed
		 */
		this.surfaceView = surfaceView;
		/** @type {boolean} */
		this.enabled = false;
		/** @type {Function} */
		this.formatNumber = formatNumber || String;
		/** @type {jQuery|null} Cached while enabled */
		this.$documentNode = null;
		/** @type {string|null} 'left' or 'right'; null until applySide() settles it */
		this.side = 'left';
		/** @type {number} The document node's own edge padding, which the gutter sits in */
		this.contentPadding = 0;
		/** @type {number} Digit count the width was last sized for */
		this.digitCount = 0;

		const teardownCheck = () => !!this.surfaceView && this.enabled;
		this.updateDebounced = ve.debounceWithTest( teardownCheck, this.update.bind( this ) );

		/** @type {jQuery} */
		this.$element = $( '<div>' )
			.addClass( 'cm-mw-ve-lineNumberGutter' )
			.attr( 'aria-hidden', 'true' );
	}

	/**
	 * Enable or disable the gutter.
	 *
	 * @param {boolean} enabled
	 */
	setEnabled( enabled ) {
		// Line numbers only apply in source mode, where each line is its own paragraph.
		enabled = !!enabled && !!this.surfaceView &&
			this.surfaceView.getSurface().getMode() === 'source';
		if ( enabled === this.enabled ) {
			if ( enabled ) {
				this.update();
			}
			return;
		}
		this.enabled = enabled;

		const surfaceView = this.surfaceView;
		if ( enabled ) {
			this.$documentNode = surfaceView.getDocument().getDocumentNode().$element;
			// Null so applySide() treats the current direction as a change and applies it.
			this.side = null;
			this.applySide();
			this.$element.insertBefore( this.$documentNode );
			surfaceView.connect( this, { position: this.updateDebounced } );
			surfaceView.getSurface().$scrollListener.on(
				'scroll.codeMirrorVeGutter', this.updateDebounced
			);
			$( window ).on( 'resize.codeMirrorVeGutter', this.updateDebounced );
			this.update();
		} else {
			surfaceView.disconnect( this, { position: this.updateDebounced } );
			surfaceView.getSurface().$scrollListener.off(
				'scroll.codeMirrorVeGutter', this.updateDebounced
			);
			$( window ).off( 'resize.codeMirrorVeGutter', this.updateDebounced );
			this.releasePadding();
			this.$element.detach().empty();
			this.$documentNode = null;
		}
	}

	/**
	 * Give back the edge padding reserved on the document node. removeProperty, not jQuery's
	 * `.css( prop, '' )`, which leaves the declaration in place under jsdom.
	 *
	 * @private
	 */
	releasePadding() {
		this.$documentNode[ 0 ].style.removeProperty(
			this.side === 'right' ? 'padding-right' : 'padding-left'
		);
	}

	/**
	 * Put the gutter on the edge the document's direction calls for. Re-checked every repaint,
	 * not settled at enable: VisualEditor binds a changeDirectionality command.
	 *
	 * @private
	 */
	applySide() {
		const side = this.surfaceView.getDocument().getDir() === 'rtl' ? 'right' : 'left';
		if ( side === this.side ) {
			return;
		}
		if ( this.side ) {
			// Or the measurement below reads back the room we made for ourselves.
			this.releasePadding();
		}
		this.side = side;
		// Sit within the document node's own padding rather than at the surface edge, so the
		// gutter stays under the floating toolbar when scrolled instead of poking out beside it.
		this.contentPadding = parseFloat( window.getComputedStyle(
			this.$documentNode[ 0 ] )[ side === 'right' ? 'paddingRight' : 'paddingLeft' ]
		) || 0;
		this.$element.css( { left: '', right: '' } ).css( side, this.contentPadding );
		// Bust the width cache, so updateWidth() reserves on the new edge.
		this.digitCount = 0;
	}

	/**
	 * Repaint the numbers for the visible lines, positioning each at its line's top.
	 */
	update() {
		if ( !this.enabled || !this.surfaceView ) {
			return;
		}
		this.applySide();
		const surfaceView = this.surfaceView,
			viewportRange = surfaceView.getViewportRange( true, VIEWPORT_PADDING );
		if ( !viewportRange ) {
			return;
		}
		const ceDocument = surfaceView.getDocument(),
			lines = ceDocument.getDocumentNode().children;
		if ( !lines.length ) {
			this.$element.empty();
			return;
		}

		let first = lines.indexOf( ceDocument.getBranchNodeFromOffset( viewportRange.start ) ),
			last = lines.indexOf( ceDocument.getBranchNodeFromOffset( viewportRange.end ) );
		if ( first === -1 ) {
			first = 0;
		}
		if ( last === -1 ) {
			last = lines.length - 1;
		}

		this.updateWidth( lines.length );

		const gutterTop = this.$element[ 0 ].getBoundingClientRect().top,
			fragment = document.createDocumentFragment(),
			// Line-heights by paragraph class. Lines need not share one (the controller sizes
			// headings), so resolve per line; cached because nearly all lines do share a class.
			lineHeights = new Map();
		for ( let i = first; i <= last; i++ ) {
			const lineElement = lines[ i ] && lines[ i ].$element[ 0 ];
			if ( !lineElement ) {
				continue;
			}
			if ( !lineHeights.has( lineElement.className ) ) {
				lineHeights.set(
					lineElement.className, window.getComputedStyle( lineElement ).lineHeight
				);
			}
			const number = document.createElement( 'div' );
			number.className = 'cm-mw-ve-lineNumber';
			number.textContent = this.formatNumber( i + 1 );
			number.style.top = ( lineElement.getBoundingClientRect().top - gutterTop ) + 'px';
			// Or the number inherits the surface's line-height, which can differ.
			number.style.lineHeight = lineHeights.get( lineElement.className );
			fragment.appendChild( number );
		}
		this.$element.empty();
		this.$element[ 0 ].appendChild( fragment );
	}

	/**
	 * Size the gutter and its reserved padding to the widest line number.
	 *
	 * @param {number} totalLines
	 * @private
	 */
	updateWidth( totalLines ) {
		const digits = String( totalLines ).length;
		if ( digits === this.digitCount ) {
			return;
		}
		this.digitCount = digits;
		// digits + room for the gap to the text and a little slack (see the stylesheet).
		this.$element.css( 'width', 'calc( ' + digits + 'ch + 15px )' );
		const width = this.$element[ 0 ].getBoundingClientRect().width;
		// Padding, not margin: the text moves inwards while the gutter stays inside the area
		// the toolbar covers.
		this.$documentNode.css(
			this.side === 'right' ? 'padding-right' : 'padding-left',
			( this.contentPadding + width ) + 'px'
		);
	}

	/**
	 * Destroy the gutter.
	 */
	destroy() {
		this.setEnabled( false );
		this.$element.remove();
		this.surfaceView = null;
	}
}

module.exports = CodeMirrorLineNumberGutter;
