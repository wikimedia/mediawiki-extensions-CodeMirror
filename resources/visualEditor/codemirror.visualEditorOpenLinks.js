/**
 * Class set on the surface's attached root while a link sits under the pointer, for the
 * pointer cursor. Separate from the class the drawn token carries, or the underline would
 * apply to the whole surface.
 *
 * @type {string}
 * @private
 */
const OPEN_LINK_CLASS = 'cm-mw-ve-openLink';

/**
 * Modifier-click to open the page, template or URL under the pointer, for the VisualEditor
 * source-mode integrations.
 *
 * CodeMirror's own openLinks extension cannot serve them, because it handles the mousedown
 * itself and CodeMirror receives no mouse events in either: the overlay integration is
 * `pointer-events: none`, and the custom-highlight one renders no editor at all. So the events
 * come from VisualEditor's surface, and only the resolution is shared.
 *
 * The caller draws the mark, because the two integrations render by different means.
 *
 * Inert until {@link CodeMirrorVisualEditorOpenLinks#setEnabled} is called.
 */
class CodeMirrorVisualEditorOpenLinks {
	/**
	 * @param {ve.ui.Surface} surface
	 * @param {Object} config
	 * @param {Function} config.resolveLinkAt `( state, position ) => { url, from, to }|null`,
	 *   from the MediaWiki mode.
	 * @param {Function} config.hasModifier `( event ) => boolean`, testing the platform's
	 *   open-links modifier.
	 * @param {string} config.modKey `KeyboardEvent.key` of that modifier.
	 * @param {Function} config.getState `() => EditorState|null`, the state holding the
	 *   tokenizer. Its document is the wikitext, so its offsets are source offsets.
	 * @param {Function} config.drawLink `( from, to ) => boolean`, taking source offsets and
	 *   returning whether the mark was drawn. Replaces whatever it drew before.
	 * @param {Function} config.clearLink `() => void`.
	 */
	constructor( surface, config ) {
		/**
		 * Null once destroyed.
		 *
		 * @type {ve.ui.Surface|null}
		 */
		this.surface = surface;
		/** @type {ve.ce.Surface} */
		this.surfaceView = surface.getView();
		/** @type {Object} */
		this.config = config;
		/** @type {boolean} */
		this.enabled = false;
		/**
		 * Last pointer position seen inside the surface, as the `pageX`/`pageY` pair
		 * {@link ve.ce.Surface#getOffsetFromEventCoords} reads. Null while the pointer is
		 * outside, so that pressing the modifier then resolves nothing.
		 *
		 * @type {Object|null}
		 */
		this.pointer = null;
		/**
		 * The drawn link's source offsets, so an unchanged token is not redrawn.
		 *
		 * @type {Object|null}
		 */
		this.drawn = null;
		/**
		 * Pending requestAnimationFrame handle, coalescing resolves during pointer movement.
		 *
		 * @type {number|null}
		 */
		this.frameHandle = null;

		this.onMouseDownBound = this.onMouseDown.bind( this );
		this.onMouseMoveBound = this.onMouseMove.bind( this );
		this.onMouseLeaveBound = this.onMouseLeave.bind( this );
		this.onModifierKeyBound = this.onModifierKey.bind( this );
		this.onInterruptBound = this.clear.bind( this );
	}

	/**
	 * Enable or disable link opening.
	 *
	 * @param {boolean} enabled
	 */
	setEnabled( enabled ) {
		// The syntax tree is over wikitext, so this only means anything in source mode.
		enabled = !!enabled && !!this.surface && this.surface.getMode() === 'source';
		if ( enabled === this.enabled ) {
			return;
		}
		this.enabled = enabled;

		// Capture phase, and on the same element VisualEditor binds its own mousedown to, so
		// that stopping the event keeps it from moving the cursor to the link we are leaving.
		const rootNode = this.surfaceView.$attachedRootNode[ 0 ];
		if ( enabled ) {
			rootNode.addEventListener( 'mousedown', this.onMouseDownBound, true );
			rootNode.addEventListener( 'mousemove', this.onMouseMoveBound );
			rootNode.addEventListener( 'mouseleave', this.onMouseLeaveBound );
			// On the document, so that holding the modifier marks the link the pointer is
			// already resting on, without waiting for it to move.
			document.addEventListener( 'keydown', this.onModifierKeyBound );
			document.addEventListener( 'keyup', this.onModifierKeyBound );
			// The modifier's keyup is lost if focus leaves the window while it is held.
			window.addEventListener( 'blur', this.onInterruptBound );
			document.addEventListener( 'visibilitychange', this.onInterruptBound );
		} else {
			rootNode.removeEventListener( 'mousedown', this.onMouseDownBound, true );
			rootNode.removeEventListener( 'mousemove', this.onMouseMoveBound );
			rootNode.removeEventListener( 'mouseleave', this.onMouseLeaveBound );
			document.removeEventListener( 'keydown', this.onModifierKeyBound );
			document.removeEventListener( 'keyup', this.onModifierKeyBound );
			window.removeEventListener( 'blur', this.onInterruptBound );
			document.removeEventListener( 'visibilitychange', this.onInterruptBound );
			this.pointer = null;
			this.clear();
		}
	}

	/**
	 * Tear down. Called when the VE surface is destroyed.
	 */
	destroy() {
		this.setEnabled( false );
		this.surface = null;
	}

	/**
	 * Open the link under the pointer, if the modifier is held.
	 *
	 * @param {MouseEvent} e
	 * @private
	 */
	onMouseDown( e ) {
		if ( e.button !== 0 || !this.config.hasModifier( e ) ) {
			return;
		}
		const link = this.resolveAt( { pageX: e.pageX, pageY: e.pageY } );
		if ( !link ) {
			return;
		}
		// Suppress VisualEditor's own handler, which would move the cursor to the link.
		e.preventDefault();
		e.stopPropagation();
		this.clear();
		window.open( link.url, '_blank', 'noopener noreferrer' );
	}

	/**
	 * @param {MouseEvent} e
	 * @private
	 */
	onMouseMove( e ) {
		this.pointer = { pageX: e.pageX, pageY: e.pageY };
		this.schedule( this.config.hasModifier( e ) );
	}

	/**
	 * @private
	 */
	onMouseLeave() {
		this.pointer = null;
		this.clear();
	}

	/**
	 * Mark or unmark the link under a stationary pointer as the modifier goes down and up. The
	 * event carries the modifier's own state, so nothing has to be tracked between the two.
	 *
	 * @param {KeyboardEvent} e
	 * @private
	 */
	onModifierKey( e ) {
		if ( e.key === this.config.modKey ) {
			this.schedule( this.config.hasModifier( e ) );
		}
	}

	/**
	 * Redraw on the next frame, or clear at once.
	 *
	 * @param {boolean} active Whether the modifier is held.
	 * @private
	 */
	schedule( active ) {
		if ( !active ) {
			this.clear();
			return;
		}
		if ( this.frameHandle ) {
			return;
		}
		this.frameHandle = requestAnimationFrame( () => {
			this.frameHandle = null;
			this.update();
		} );
	}

	/**
	 * Draw the link under the pointer, if there is one.
	 *
	 * @private
	 */
	update() {
		const link = this.resolveAt( this.pointer );
		if ( !link ) {
			this.clear();
			return;
		}
		if ( this.drawn && this.drawn.from === link.from && this.drawn.to === link.to ) {
			return;
		}
		// drawLink replaces what it drew before, so it needs no clear first. On failure the
		// previous mark is still there, which clear() then removes.
		if ( !this.config.drawLink( link.from, link.to ) ) {
			this.clear();
			return;
		}
		this.surfaceView.$attachedRootNode.addClass( OPEN_LINK_CLASS );
		this.drawn = link;
	}

	/**
	 * Undraw any marked link.
	 *
	 * @private
	 */
	clear() {
		if ( this.frameHandle ) {
			cancelAnimationFrame( this.frameHandle );
			this.frameHandle = null;
		}
		if ( !this.drawn ) {
			return;
		}
		this.config.clearLink();
		this.surfaceView.$attachedRootNode.removeClass( OPEN_LINK_CLASS );
		this.drawn = null;
	}

	/**
	 * Resolve the link at a pointer position.
	 *
	 * @param {Object|null} pointer `pageX`/`pageY` pair
	 * @return {Object|null} `{ url, from, to }` in source offsets, or null
	 * @private
	 */
	resolveAt( pointer ) {
		const state = this.enabled && pointer && this.config.getState();
		if ( !state ) {
			return null;
		}
		const offset = this.surfaceView.getOffsetFromEventCoords( pointer );
		if ( offset === -1 || offset === undefined ) {
			return null;
		}
		let sourceOffset;
		try {
			sourceOffset = this.surface.getModel().getSourceOffsetFromOffset( offset );
		} catch ( e ) {
			// Out of bounds, e.g. the pointer is past the end of the document.
			return null;
		}
		// The offset comes from VisualEditor's model but is read against CodeMirror's document,
		// and the two are only synchronised on 'precommit'. Clamp rather than let a position
		// past the end reach the syntax tree, which throws on one.
		return this.config.resolveLinkAt(
			state, Math.min( sourceOffset, state.doc.length )
		);
	}
}

module.exports = CodeMirrorVisualEditorOpenLinks;
