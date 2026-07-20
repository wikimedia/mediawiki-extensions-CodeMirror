const {
	EditorState,
	ensureSyntaxTree,
	highlightTree,
	syntaxTree
} = require( 'ext.CodeMirror.lib' );
const {
	CodeMirrorExtensionRegistry,
	CodeMirrorPreferences,
	CodeMirrorThemes
} = require( 'ext.CodeMirror' );

/**
 * Milliseconds allowed for {@link ensureSyntaxTree} to parse up to the end of the
 * viewport before we fall back to whatever has been parsed so far.
 *
 * @type {number}
 * @private
 */
const PARSE_BUDGET = 50;

/**
 * Extra vertical padding (in DM offsets) added above and below the viewport so that
 * highlighting is ready slightly before content scrolls into view.
 *
 * @type {number}
 * @private
 */
const VIEWPORT_PADDING = 100;

/**
 * Class added to the VE surface to scope the colorblind `::highlight()` overrides. Named to
 * match what {@link CodeMirrorThemes} puts on `.cm-content` for the same theme.
 *
 * @type {string}
 * @private
 */
const COLORBLIND_CLASS = 'cm-mw-colorblind-colors';

/**
 * Class added to the VE surface while the `highlightRefs` preference is on. The EditorView
 * integration applies that as a CodeMirror theme, which has no equivalent without a view.
 *
 * @type {string}
 * @private
 */
const REFS_CLASS = 'cm-mw-highlight-refs';

/**
 * Syntax highlighter for the VisualEditor
 * {@link https://www.mediawiki.org/wiki/Special:MyLanguage/2017_wikitext_editor 2017 wikitext editor}
 * that renders nothing of its own. Unlike {@link CodeMirrorVisualEditor} it creates no
 * EditorView: a headless {@link EditorState} drives CodeMirror's tokenizer, and the colors are
 * painted onto VisualEditor's own text with the
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/CSS_Custom_Highlight_API CSS Custom Highlight API}
 * via {@link ve.ce.SelectionManager#drawSelections}.
 *
 * With no second rendered layer there is nothing to keep aligned, and the cost is bounded by the
 * viewport rather than the document.
 */
class CodeMirrorVisualEditorHighlight {
	/**
	 * @param {ve.ui.Surface} surface
	 * @param {CodeMirrorMediaWiki} langSupport MediaWiki mode instance, exposing `language`,
	 *   `parser` and `highlightStyle`.
	 */
	constructor( surface, langSupport ) {
		/** @type {ve.ui.Surface} */
		this.surface = surface;
		/** @type {ve.ce.Surface} */
		this.surfaceView = surface.getView();
		/** @type {CodeMirrorMediaWiki} */
		this.langSupport = langSupport;
		/** @type {HighlightStyle} */
		this.highlightStyle = langSupport.highlightStyle;
		/**
		 * Language name, used when persisting the user preference.
		 *
		 * @type {string}
		 */
		this.mode = langSupport.language && langSupport.language.name;
		/** @type {boolean} */
		this.isActive = false;
		/**
		 * Headless tokenizer state, driving CodeMirror's incremental parse without rendering.
		 *
		 * @type {EditorState|null}
		 */
		this.tokenizer = null;
		/**
		 * Pending requestAnimationFrame handle, used to coalesce refreshes.
		 *
		 * @type {number|null}
		 */
		this.frameHandle = null;
		/**
		 * Highlight group names currently drawn, so stale ones can be removed.
		 *
		 * @type {Set<string>}
		 */
		this.drawnGroups = new Set();
		/**
		 * Whether the CSS Custom Highlight API is available.
		 *
		 * @type {boolean}
		 */
		this.supported = !!( window.CSS && window.CSS.highlights );
		/**
		 * Preference resolution. `isVisualEditor` is false because that flag means the
		 * EditorView overlay: it gates the extension allowlist, and makes getPreference ignore
		 * stored values because the overlay has no UI to set them. Neither applies here.
		 *
		 * @type {CodeMirrorPreferences}
		 */
		this.preferences = new CodeMirrorPreferences(
			new CodeMirrorExtensionRegistry( {}, false ), this.mode, {}, false
		);
		// Registers the theme preference's form specification, so the preferences page can
		// offer it as a choice rather than a switch.
		this.themes = new CodeMirrorThemes( this.preferences );
		/**
		 * The `theme` preference: `default`, `colorblind` or `no-highlight` for this mode. Light
		 * and dark variants are resolved in CSS, so only the base name matters here.
		 *
		 * @type {string}
		 */
		this.theme = this.getPreference( 'theme' ) || 'default';
		/**
		 * Whether to paint syntax colors: the `no-highlight` theme (T419339) turns them off.
		 * Bracket matching and line numbering have their own preferences and are unaffected,
		 * matching {@link CodeMirrorThemes}, where those styles sit outside the theme's rules.
		 *
		 * @type {boolean}
		 */
		this.syntaxHighlightingEnabled = this.theme !== 'no-highlight';
		/**
		 * Whether to tint the contents of <ref> tags.
		 *
		 * @type {boolean}
		 */
		this.highlightRefsEnabled = !!this.getPreference( 'highlightRefs' );

		this.onDocumentPrecommitBound = this.onDocumentPrecommit.bind( this );
		this.scheduleRefreshBound = this.scheduleRefresh.bind( this );
	}

	/**
	 * Initialize and activate the highlighter.
	 *
	 * @stable to call
	 */
	initialize() {
		if ( this.surface.getMode() !== 'source' ) {
			mw.log.warn( '[CodeMirror] Attempted to initialize CodeMirrorVisualEditorHighlight in non-source mode.' );
			return;
		}
		this.activate();
	}

	/**
	 * Toggle highlighting on or off.
	 *
	 * @param {boolean} [force] `true` to enable, `false` to disable. Inverts current state
	 *   if undefined.
	 * @stable to call
	 */
	toggle( force ) {
		const toEnable = force === undefined ? !this.isActive : force;
		if ( toEnable ) {
			this.activate();
		} else {
			this.deactivate();
		}
	}

	/**
	 * Activate highlighting: build the tokenizer and bind listeners.
	 */
	activate() {
		if ( this.isActive ) {
			return;
		}
		if ( !this.supported ) {
			mw.log.warn( '[CodeMirror] CSS Custom Highlight API is unavailable; VisualEditor highlighting is disabled.' );
			return;
		}

		this.tokenizer = EditorState.create( {
			doc: this.surface.getDom(),
			extensions: this.langSupport.language
		} );
		this.isActive = true;
		this.logEditFeature( 'activated' );

		this.surface.getModel().getDocument().on( 'precommit', this.onDocumentPrecommitBound );
		if ( this.theme === 'colorblind' ) {
			this.surfaceView.$element.addClass( COLORBLIND_CLASS );
		}
		if ( this.highlightRefsEnabled ) {
			this.surfaceView.$element.addClass( REFS_CLASS );
		}
		if ( this.syntaxHighlightingEnabled ) {
			this.bindSyntaxListeners();
			this.scheduleRefresh();
		}
	}

	/**
	 * Deactivate highlighting: unbind listeners and clear all highlights.
	 */
	deactivate() {
		if ( !this.isActive ) {
			return;
		}

		this.surface.getModel().getDocument().off( 'precommit', this.onDocumentPrecommitBound );
		this.unbindSyntaxListeners();
		if ( this.theme === 'colorblind' ) {
			this.surfaceView.$element.removeClass( COLORBLIND_CLASS );
		}
		this.surfaceView.$element.removeClass( REFS_CLASS );

		if ( this.frameHandle ) {
			cancelAnimationFrame( this.frameHandle );
			this.frameHandle = null;
		}

		this.clearAllHighlights();
		this.tokenizer = null;
		this.isActive = false;
		this.logEditFeature( 'deactivated' );
	}

	/**
	 * Tear down the controller. Called when the VE surface is destroyed.
	 *
	 * @stable to call
	 */
	destroy() {
		this.deactivate();
	}

	/**
	 * Persist the `usecodemirror` user preference. Mirrors
	 * {@link CodeMirror#setCodeMirrorPreference}.
	 *
	 * @param {boolean} prefValue
	 * @stable to call
	 */
	setCodeMirrorPreference( prefValue ) {
		if ( !mw.user.isNamed() ) {
			return;
		}
		const optionName = 'usecodemirror';
		if ( mw.user.options.get( optionName ) > 0 && prefValue ) {
			return;
		}
		new mw.Api().saveOption( optionName, prefValue ? 1 : 0, { global: 'update' } );
		mw.user.options.set( optionName, prefValue ? 1 : 0 );
	}

	/**
	 * Resolve a CodeMirror preference.
	 *
	 * @param {string} prefName
	 * @return {PrefValue}
	 * @private
	 */
	getPreference( prefName ) {
		return this.preferences.getPreference( prefName );
	}

	/**
	 * Apply a transaction's delta to the tokenizer. Precommit, so the document is still in the
	 * old state that the tokenizer's contents match.
	 *
	 * @param {ve.dm.Transaction} tx
	 * @private
	 */
	onDocumentPrecommit( tx ) {
		if ( !this.tokenizer ) {
			return;
		}

		const model = this.surface.getModel(),
			store = model.getDocument().getStore(),
			docLength = this.tokenizer.doc.length,
			changes = [];
		let offset = 0;

		tx.operations.forEach( ( op ) => {
			if ( op.type === 'retain' ) {
				offset += op.length;
			} else if ( op.type === 'replace' ) {
				const from = model.getSourceOffsetFromOffset( offset ),
					to = model.getSourceOffsetFromOffset( offset + op.remove.length ),
					insert = new ve.dm.ElementLinearData( store, op.insert ).getSourceText(),
					// T382769: setContents' replacement range overshoots the doc by one
					// and adds a trailing newline.
					isSetContents = to === docLength + 1 && insert.endsWith( '\n' );
				changes.push( {
					from,
					to: isSetContents ? to - 1 : to,
					insert: isSetContents ? insert.slice( 0, -1 ) : insert
				} );
				offset += op.remove.length;
			}
		} );

		if ( changes.length ) {
			// Positions are in the pre-transaction document, so CodeMirror rebases them itself.
			this.tokenizer = this.tokenizer.update( { changes } ).state;
		}

		this.scheduleRefresh();
	}

	/**
	 * Preferences this controller honours, for {@link ve.ui.CodeMirrorPreferencesPage}. It
	 * registers no CodeMirror extensions, so its registry cannot answer this.
	 *
	 * @type {string[]}
	 */
	get supportedPreferences() {
		return [ 'theme', 'highlightRefs' ];
	}

	/**
	 * Apply a preference to the running controller. There is no EditorView to reconfigure, so
	 * each one is re-derived by hand.
	 *
	 * @param {string} name
	 * @param {PrefValue} value
	 */
	applyPreference( name, value ) {
		switch ( name ) {
			case 'theme':
				this.theme = value;
				this.syntaxHighlightingEnabled = value !== 'no-highlight';
				this.surfaceView.$element.toggleClass(
					COLORBLIND_CLASS, value === 'colorblind'
				);
				if ( this.syntaxHighlightingEnabled ) {
					this.bindSyntaxListeners();
					this.scheduleRefresh();
				} else {
					this.unbindSyntaxListeners();
					this.clearAllHighlights();
				}
				break;
			case 'highlightRefs':
				this.highlightRefsEnabled = !!value;
				this.surfaceView.$element.toggleClass( REFS_CLASS, this.highlightRefsEnabled );
				break;
		}
	}

	/**
	 * Listen for what changes which text is visible. Unbinds first, so it can run again when
	 * the theme switches highlighting back on.
	 *
	 * @private
	 */
	bindSyntaxListeners() {
		this.unbindSyntaxListeners();
		this.surfaceView.on( 'position', this.scheduleRefreshBound );
		// $scrollListener, not $scrollContainer: for a document-level scroller the container
		// is <html> but the scroll event fires on window. Matches VE's own SelectionManager.
		this.surface.$scrollListener.on(
			'scroll.codeMirrorVeHighlight', this.scheduleRefreshBound
		);
		$( window ).on( 'resize.codeMirrorVeHighlight', this.scheduleRefreshBound );
	}

	/**
	 * @private
	 */
	unbindSyntaxListeners() {
		this.surfaceView.off( 'position', this.scheduleRefreshBound );
		this.surface.$scrollListener.off(
			'scroll.codeMirrorVeHighlight', this.scheduleRefreshBound
		);
		$( window ).off( 'resize.codeMirrorVeHighlight' );
	}

	/**
	 * Coalesce scroll/position/edit/resize events into a single refresh per animation frame.
	 *
	 * @private
	 */
	scheduleRefresh() {
		// onDocumentPrecommit schedules on every transaction, so bail here rather than burn an
		// animation frame per keystroke under the no-highlight theme.
		if ( this.frameHandle || !this.syntaxHighlightingEnabled ) {
			return;
		}
		this.frameHandle = requestAnimationFrame( () => {
			this.frameHandle = null;
			this.refresh();
		} );
	}

	/**
	 * Map a source offset to a surface (DM) offset: the source offset plus one per preceding line
	 * boundary. Like {@link ve.dm.Surface#getOffsetFromSourceOffset}, but takes the line number
	 * from the tokenizer (O(log n)) instead of walking the document (O(n)).
	 *
	 * @param {number} sourceOffset
	 * @return {number} Surface offset
	 * @private
	 */
	getSurfaceOffsetFromSourceOffset( sourceOffset ) {
		return sourceOffset + this.tokenizer.doc.lineAt( sourceOffset ).number;
	}

	/**
	 * Resolve a source range to a native DOM Range in O(1), via the line's own text node. Avoids
	 * {@link ve.ce.Surface#getNativeRange}, which walks the document from the start and dominates
	 * a viewport's paint cost. Returns null outside that fast case, leaving drawSelections to
	 * fall back to getNativeRange.
	 *
	 * @param {number} from Source offset
	 * @param {number} to Source offset
	 * @return {Range|null}
	 * @private
	 */
	getHighlightRange( from, to ) {
		const line = this.tokenizer.doc.lineAt( from );
		// Only tokens within a single line take the fast path.
		if ( to > line.to ) {
			return null;
		}
		const lines = this.surfaceView.getDocument().getDocumentNode().children,
			lineNode = lines[ line.number - 1 ],
			paragraph = lineNode && lineNode.$element[ 0 ];
		// Require a single text node spanning the line (the common, token-dense case).
		if ( !paragraph || paragraph.childNodes.length !== 1 ||
			paragraph.firstChild.nodeType !== Node.TEXT_NODE ) {
			return null;
		}
		try {
			const range = document.createRange();
			range.setStart( paragraph.firstChild, from - line.from );
			range.setEnd( paragraph.firstChild, to - line.from );
			return range;
		} catch ( e ) {
			// e.g. the offsets fall outside the text node.
			return null;
		}
	}

	/**
	 * Tokenize the visible portion of the document and paint syntax colors onto the VE surface.
	 *
	 * @private
	 */
	refresh() {
		if ( !this.isActive || !this.tokenizer || !this.syntaxHighlightingEnabled ) {
			return;
		}

		const model = this.surface.getModel(),
			viewportRange = this.surfaceView.getViewportRange( true, VIEWPORT_PADDING );
		if ( !viewportRange ) {
			return;
		}

		const docLength = this.tokenizer.doc.length;
		let srcFrom, srcTo;
		try {
			srcFrom = Math.min( model.getSourceOffsetFromOffset( viewportRange.start ), docLength );
			srcTo = Math.min( model.getSourceOffsetFromOffset( viewportRange.end ), docLength );
		} catch ( e ) {
			return;
		}
		if ( srcTo <= srcFrom ) {
			return;
		}

		const tree = ensureSyntaxTree( this.tokenizer, srcTo, PARSE_BUDGET ) ||
			syntaxTree( this.tokenizer );
		if ( !tree ) {
			return;
		}

		const groups = new Map();
		// DOM ranges keyed by selection, letting drawSelections skip getNativeRange per token.
		const nativeRanges = new Map();
		highlightTree( tree, this.highlightStyle, ( from, to, classes ) => {
			let range;
			try {
				range = new ve.Range(
					this.getSurfaceOffsetFromSourceOffset( from ),
					this.getSurfaceOffsetFromSourceOffset( to )
				);
			} catch ( e ) {
				return;
			}
			const ceSelection = this.surfaceView.getSelection(
				model.getLinearFragment( range ).getSelection()
			);
			const domRange = this.getHighlightRange( from, to );
			if ( domRange ) {
				nativeRanges.set( ceSelection, domRange );
			}
			// `classes` may be several space-separated CSS classes; each becomes its own
			// highlight group so a single ::highlight() selector matches it.
			classes.split( ' ' ).forEach( ( className ) => {
				if ( !className ) {
					return;
				}
				if ( !groups.has( className ) ) {
					groups.set( className, [] );
				}
				groups.get( className ).push( ceSelection );
			} );
		}, srcFrom, srcTo );

		const selectionManager = this.surfaceView.getSelectionManager(),
			options = {
				showRects: false,
				showCustomHighlight: true,
				customHighlightRanges: nativeRanges
			},
			active = new Set();

		groups.forEach( ( selections, className ) => {
			const name = 'syntax-' + className;
			active.add( name );
			selectionManager.drawSelections( name, selections, options );
		} );

		// Remove highlight groups that are no longer present in the viewport.
		this.drawnGroups.forEach( ( name ) => {
			if ( !active.has( name ) ) {
				selectionManager.drawSelections( name, [] );
			}
		} );

		this.drawnGroups = active;
	}

	/**
	 * Remove every highlight group drawn by this controller.
	 *
	 * @private
	 */
	clearAllHighlights() {
		const selectionManager = this.surfaceView.getSelectionManager();
		this.drawnGroups.forEach( ( name ) => selectionManager.drawSelections( name, [] ) );
		this.drawnGroups = new Set();
	}

	/**
	 * Log usage of CodeMirror to the VisualEditorFeatureUse schema.
	 *
	 * @see https://phabricator.wikimedia.org/T373710
	 * @param {string} action
	 * @private
	 */
	logEditFeature( action ) {
		mw.track( 'visualEditorFeatureUse', { feature: 'codemirror', action } );
	}
}

module.exports = CodeMirrorVisualEditorHighlight;
