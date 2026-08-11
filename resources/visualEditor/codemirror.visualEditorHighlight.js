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
const { findBracketMatch } = require( '../codemirror.matchbrackets.util.js' );
const CodeMirrorVisualEditorHighlightLineNumbering = require( './codemirror.visualEditorHighlight.lineNumbering.js' );

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
 * Matches a wikitext heading line; the `=` run's length is the level. Mirrors
 * Parser::handleHeadings: the longest balanced pair wins, and needs content between.
 *
 * @type {RegExp}
 * @private
 */
const HEADING_RE = /^(={1,6}).+?\1[ \t]*$/;

/**
 * Class set on the VE paragraph node of the line holding the cursor. CodeMirror's
 * .cm-activeLine is a line decoration; ::highlight() paints only behind glyphs, so a
 * full-width background has to come from the node.
 *
 * @type {string}
 * @private
 */
const ACTIVE_LINE_CLASS = 'cm-mw-ve-activeLine';

/**
 * Trailing whitespace on a line, as highlightTrailingWhitespace matches it.
 *
 * @type {RegExp}
 * @private
 */
const TRAILING_WHITESPACE_RE = /\s+$/;

/**
 * Runs of spaces and tabs anywhere in a line, for the `whitespace` preference.
 *
 * @type {RegExp}
 * @private
 */
const WHITESPACE_RE = /[ \t]+/g;

/**
 * Highlight group for whitespace. Unlike trailing whitespace this is viewport-bounded: nearly
 * every line has some, so a whole-document pass would paint thousands of ranges.
 *
 * @type {string}
 * @private
 */
const WHITESPACE_GROUP = 'cm-whitespace';

/**
 * Highlight group for trailing whitespace. `cm-` prefixed like the syntax groups, which reach
 * `visualeditor-syntax-cm-*` through the mode's own class names: SelectionManager group names
 * share one document-wide namespace, so they want the same qualifier.
 *
 * Drawn whole-document rather than viewport-bounded: matches are rare, and VisualEditor's
 * SelectionManager then maintains the group itself across re-renders and scrolls, so only edits
 * need to recompute it.
 *
 * @type {string}
 * @private
 */
const TRAILING_WHITESPACE_GROUP = 'cm-trailing-whitespace';

/**
 * Class prefix (plus the level) set on the VE paragraph node of a heading line. font-size is
 * beyond the Custom Highlight API, and is safe here only because there's no overlay to keep
 * aligned; the EditorView integration has to neutralise the same rules (T432950).
 *
 * The following classes are used here:
 * * cm-mw-ve-section-1
 * * cm-mw-ve-section-2
 * * cm-mw-ve-section-3
 * * cm-mw-ve-section-4
 * * cm-mw-ve-section-5
 * * cm-mw-ve-section-6
 *
 * @type {string}
 * @private
 */
const SECTION_CLASS_PREFIX = 'cm-mw-ve-section-';

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
	 * @param {Function} [matchTag] Headless tag matcher `matchTag( state, pos )`, returning the
	 *   same `{ matched, start, end }` shape as {@link findBracketMatch}. Omitted if unsupported.
	 */
	constructor( surface, langSupport, matchTag ) {
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
		 * Bracket-matching config (bracket set and scan distance), reused from the mode.
		 *
		 * @type {Object}
		 */
		this.bracketConfig = Object.assign(
			{ brackets: '()[]{}', maxScanDistance: 10000 },
			langSupport.bracketMatchingConfig
		);
		/**
		 * Headless tag matcher, so tag pairs (e.g. `<ref>`/`</ref>`) match under the same
		 * `bracketMatching` preference as brackets.
		 *
		 * @type {Function|null}
		 */
		this.matchTag = matchTag || null;
		/**
		 * Whether bracket matching is enabled, from the user's `bracketMatching` preference.
		 *
		 * @type {boolean}
		 */
		this.bracketMatchingEnabled = !!this.getPreference( 'bracketMatching' );
		/**
		 * Bracket highlight groups currently drawn, kept apart from the syntax groups so a
		 * syntax refresh does not clear them.
		 *
		 * @type {Set<string>}
		 */
		this.bracketGroups = new Set();
		/**
		 * Pending requestAnimationFrame handle for coalescing bracket-match updates.
		 *
		 * @type {number|null}
		 */
		this.bracketFrameHandle = null;
		/**
		 * Whether the line-number gutter is on: the `lineNumbering` preference, but never in
		 * DiscussionTools.
		 *
		 * @type {boolean}
		 */
		this.lineNumberingEnabled = !!this.getPreference( 'lineNumbering' ) &&
			!this.isDiscussionTools();
		/**
		 * The line-number gutter. There is no EditorView to host CodeMirror's own, so this
		 * draws numbers beside VisualEditor's paragraphs instead.
		 *
		 * @type {CodeMirrorVisualEditorHighlightLineNumbering}
		 */
		this.lineNumberGutter = new CodeMirrorVisualEditorHighlightLineNumbering(
			this.surfaceView, this.formatLineNumber.bind( this )
		);
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
		/**
		 * Whether to mark the line holding the cursor, from the `activeLine` preference.
		 *
		 * @type {boolean}
		 */
		this.activeLineEnabled = !!this.getPreference( 'activeLine' );
		/**
		 * Node currently carrying {@link ACTIVE_LINE_CLASS}. Held as the element rather than a
		 * line number: an edit elsewhere shifts line numbers, and clearing by index would then
		 * strip the class off whichever node had moved into that slot, stranding this one.
		 *
		 * @type {jQuery|null}
		 */
		this.$activeLineNode = null;
		/**
		 * Whether to mark spaces and tabs, from the `whitespace` preference.
		 *
		 * @type {boolean}
		 */
		this.whitespaceEnabled = !!this.getPreference( 'whitespace' );
		/**
		 * Whether the whitespace group is currently drawn.
		 *
		 * @type {boolean}
		 */
		this.whitespaceDrawn = false;
		/**
		 * Whether to mark trailing whitespace, from the `trailingWhitespace` preference.
		 *
		 * @type {boolean}
		 */
		this.trailingWhitespaceEnabled = !!this.getPreference( 'trailingWhitespace' );
		/**
		 * Pending requestAnimationFrame handle for trailing-whitespace updates.
		 *
		 * @type {number|null}
		 */
		this.trailingWhitespaceFrameHandle = null;
		/**
		 * Whether the trailing-whitespace group is currently drawn, so clearing it is a no-op
		 * when it never was.
		 *
		 * @type {boolean}
		 */
		this.trailingWhitespaceDrawn = false;
		/**
		 * Heading line numbers (1-based) to level, so the classes can be removed again.
		 *
		 * @type {Map<number,number>}
		 */
		this.headingLines = new Map();
		/**
		 * Pending requestAnimationFrame handle for heading updates.
		 *
		 * @type {number|null}
		 */
		this.headingFrameHandle = null;

		this.onDocumentPrecommitBound = this.onDocumentPrecommit.bind( this );
		this.scheduleRefreshBound = this.scheduleRefresh.bind( this );
		this.scheduleBracketMatchBound = this.scheduleBracketMatch.bind( this );
		this.updateActiveLineBound = this.updateActiveLine.bind( this );
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

		// Bound regardless of theme: bracket matching needs the tokenizer kept in sync.
		this.surface.getModel().getDocument().on( 'precommit', this.onDocumentPrecommitBound );
		if ( this.theme === 'colorblind' ) {
			this.surfaceView.$element.addClass( COLORBLIND_CLASS );
		}
		if ( this.highlightRefsEnabled ) {
			this.surfaceView.$element.addClass( REFS_CLASS );
		}
		if ( this.viewportPassEnabled ) {
			this.bindSyntaxListeners();
			this.scheduleRefresh();
			this.scheduleHeadings();
		}
		if ( this.bracketMatchingEnabled ) {
			// Bracket matching depends on the cursor position, so it tracks 'select', not scroll.
			this.surface.getModel().on( 'select', this.scheduleBracketMatchBound );
			this.scheduleBracketMatch();
		}
		if ( this.activeLineEnabled ) {
			this.surface.getModel().on( 'select', this.updateActiveLineBound );
			this.updateActiveLine();
		}
		if ( this.trailingWhitespaceEnabled ) {
			this.scheduleTrailingWhitespace();
		}
		this.lineNumberGutter.setEnabled( this.lineNumberingEnabled );
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
		this.surface.getModel().off( 'select', this.scheduleBracketMatchBound );
		this.surface.getModel().off( 'select', this.updateActiveLineBound );
		if ( this.theme === 'colorblind' ) {
			this.surfaceView.$element.removeClass( COLORBLIND_CLASS );
		}
		this.surfaceView.$element.removeClass( REFS_CLASS );

		if ( this.frameHandle ) {
			cancelAnimationFrame( this.frameHandle );
			this.frameHandle = null;
		}
		if ( this.bracketFrameHandle ) {
			cancelAnimationFrame( this.bracketFrameHandle );
			this.bracketFrameHandle = null;
		}
		if ( this.headingFrameHandle ) {
			cancelAnimationFrame( this.headingFrameHandle );
			this.headingFrameHandle = null;
		}
		if ( this.trailingWhitespaceFrameHandle ) {
			cancelAnimationFrame( this.trailingWhitespaceFrameHandle );
			this.trailingWhitespaceFrameHandle = null;
		}

		this.clearAllHighlights();
		this.clearBracketMatch();
		this.clearActiveLine();
		this.clearWhitespace();
		this.clearTrailingWhitespace();
		this.clearHeadings();
		this.lineNumberGutter.setEnabled( false );
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
		// Owned outright, unlike everything else here, which only borrows VE's surface.
		this.lineNumberGutter.destroy();
		this.themes.destroy();
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
	 * Whether this is a DiscussionTools surface, by the same check
	 * {@link CodeMirrorVisualEditor} uses.
	 *
	 * @return {boolean}
	 * @private
	 */
	isDiscussionTools() {
		const target = this.surface.getTarget && this.surface.getTarget();
		return !!target && target.constructor.name === 'CommentTarget';
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
		// Headings and trailing whitespace track the document, not the viewport, so they only
		// update on edits.
		this.scheduleHeadings();
		this.scheduleTrailingWhitespace();
	}

	/**
	 * Preferences this controller honours, for {@link ve.ui.CodeMirrorPreferencesPage}. It
	 * registers no CodeMirror extensions, so its registry cannot answer this.
	 *
	 * @type {string[]}
	 */
	get supportedPreferences() {
		return [
			'theme', 'highlightRefs', 'bracketMatching', 'lineNumbering',
			'activeLine', 'whitespace', 'trailingWhitespace'
		];
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
					this.scheduleHeadings();
				} else if ( this.viewportPassEnabled ) {
					// Whitespace rides the same pass; keep it running without the colors.
					this.scheduleRefresh();
					this.clearAllHighlights();
					this.clearHeadings();
				} else {
					this.unbindSyntaxListeners();
					this.clearAllHighlights();
					this.clearHeadings();
				}
				break;
			case 'highlightRefs':
				this.highlightRefsEnabled = !!value;
				this.surfaceView.$element.toggleClass( REFS_CLASS, this.highlightRefsEnabled );
				break;
			case 'bracketMatching':
				this.bracketMatchingEnabled = !!value;
				this.surface.getModel().off( 'select', this.scheduleBracketMatchBound );
				if ( value ) {
					this.surface.getModel().on( 'select', this.scheduleBracketMatchBound );
					this.scheduleBracketMatch();
				} else {
					this.clearBracketMatch();
				}
				break;
			case 'activeLine':
				this.activeLineEnabled = !!value;
				this.surface.getModel().off( 'select', this.updateActiveLineBound );
				if ( value ) {
					this.surface.getModel().on( 'select', this.updateActiveLineBound );
					this.updateActiveLine();
				} else {
					this.clearActiveLine();
				}
				break;
			case 'whitespace':
				this.whitespaceEnabled = !!value;
				if ( value ) {
					this.bindSyntaxListeners();
					this.scheduleRefresh();
				} else {
					this.clearWhitespace();
					if ( !this.viewportPassEnabled ) {
						this.unbindSyntaxListeners();
					}
				}
				break;
			case 'trailingWhitespace':
				this.trailingWhitespaceEnabled = !!value;
				if ( value ) {
					this.scheduleTrailingWhitespace();
				} else {
					this.clearTrailingWhitespace();
				}
				break;
			case 'lineNumbering':
				this.lineNumberingEnabled = !!value && !this.isDiscussionTools();
				this.lineNumberGutter.setEnabled( this.lineNumberingEnabled );
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
		if ( this.frameHandle || !this.viewportPassEnabled ) {
			return;
		}
		this.frameHandle = requestAnimationFrame( () => {
			this.frameHandle = null;
			this.refresh();
		} );
	}

	/**
	 * Coalesce heading updates into one per animation frame. Scheduled from precommit, so the
	 * callback runs once VisualEditor has applied the transaction and re-rendered.
	 *
	 * @private
	 */
	scheduleHeadings() {
		if ( this.headingFrameHandle || !this.syntaxHighlightingEnabled ) {
			return;
		}
		this.headingFrameHandle = requestAnimationFrame( () => {
			this.headingFrameHandle = null;
			this.updateHeadings();
		} );
	}

	/**
	 * Set a heading-level class on the VisualEditor paragraph node of every heading line.
	 *
	 * Whole-document, unlike the viewport-bounded {@link refresh}: font-size affects layout, so
	 * sizing only the visible lines would make content jump on scroll, and feed back into the
	 * viewport range that triggered the pass.
	 *
	 * @private
	 */
	updateHeadings() {
		if ( !this.isActive || !this.tokenizer || !this.syntaxHighlightingEnabled ) {
			return;
		}

		// Re-derive from scratch so nothing has to reason about how line numbers shifted when
		// lines were added or removed; re-adding also repairs nodes VE has re-rendered.
		const previous = this.clearHeadings(),
			// Source mode renders one paragraph per line, as getHighlightRange also relies on.
			lines = this.surfaceView.getDocument().getDocumentNode().children;
		let lineNumber = 0,
			changed = false;
		for ( const text of this.tokenizer.doc.iterLines() ) {
			lineNumber++;
			// 61 is '=': skip the regex for the overwhelming majority of lines.
			if ( text.charCodeAt( 0 ) !== 61 ) {
				continue;
			}
			const match = HEADING_RE.exec( text );
			const node = match && lines[ lineNumber - 1 ];
			if ( !node ) {
				continue;
			}
			const level = match[ 1 ].length;
			this.headingLines.set( lineNumber, level );
			// eslint-disable-next-line mediawiki/class-doc
			node.$element.addClass( SECTION_CLASS_PREFIX + level );
			changed = changed || previous.get( lineNumber ) !== level;
			previous.delete( lineNumber );
		}

		// Heading sizes change line heights, which the gutter measures, but a class change emits
		// no 'position' event to prompt it. Anything left in `previous` stopped being a heading.
		if ( changed || previous.size ) {
			this.lineNumberGutter.update();
		}
	}

	/**
	 * Move {@link ACTIVE_LINE_CLASS} to the line holding the cursor. Like CodeMirror's
	 * highlightActiveLine this follows the selection's focus end, so it tracks a growing
	 * selection rather than staying at its anchor.
	 *
	 * @private
	 */
	updateActiveLine() {
		if ( !this.isActive || !this.tokenizer || !this.activeLineEnabled ) {
			return;
		}

		const model = this.surface.getModel(),
			selection = model.getSelection(),
			range = selection && selection.getCoveringRange && selection.getCoveringRange();
		if ( !range ) {
			this.clearActiveLine();
			return;
		}

		let lineNumber;
		try {
			// The focus end, so the mark follows a growing selection instead of staying at
			// its anchor. Older ranges only expose the normalised end.
			const offset = range.to === undefined ? range.end : range.to;
			const sourceOffset = model.getSourceOffsetFromOffset( offset );
			lineNumber = this.tokenizer.doc.lineAt(
				Math.min( Math.max( sourceOffset, 0 ), this.tokenizer.doc.length )
			).number;
		} catch ( e ) {
			this.clearActiveLine();
			return;
		}

		const node = this.surfaceView.getDocument().getDocumentNode().children[ lineNumber - 1 ],
			$node = node && node.$element;
		// Compare nodes, not line numbers, so a re-rendered node is re-marked rather than
		// skipped as unchanged.
		if ( $node && this.$activeLineNode && this.$activeLineNode[ 0 ] === $node[ 0 ] ) {
			return;
		}
		this.clearActiveLine();
		if ( $node ) {
			$node.addClass( ACTIVE_LINE_CLASS );
			this.$activeLineNode = $node;
		}
	}

	/**
	 * Remove the active-line class, if it is set.
	 *
	 * @private
	 */
	clearActiveLine() {
		if ( !this.$activeLineNode ) {
			return;
		}
		this.$activeLineNode.removeClass( ACTIVE_LINE_CLASS );
		this.$activeLineNode = null;
	}

	/**
	 * Coalesce trailing-whitespace updates into the next animation frame, so a burst of
	 * transactions repaints once.
	 *
	 * @private
	 */
	scheduleTrailingWhitespace() {
		if ( this.trailingWhitespaceFrameHandle || !this.trailingWhitespaceEnabled ) {
			return;
		}
		this.trailingWhitespaceFrameHandle = requestAnimationFrame( () => {
			this.trailingWhitespaceFrameHandle = null;
			this.updateTrailingWhitespace();
		} );
	}

	/**
	 * Paint the trailing whitespace of every line.
	 *
	 * No `customHighlightRanges`: the pre-resolved Ranges are keyed by selection, which
	 * SelectionManager#redrawSelections replaces when it re-resolves the group, so they would
	 * only serve this first paint. Letting it resolve its own keeps the group correct for free.
	 *
	 * @private
	 */
	updateTrailingWhitespace() {
		if ( !this.isActive || !this.tokenizer || !this.trailingWhitespaceEnabled ) {
			return;
		}

		const model = this.surface.getModel(),
			selections = [];
		// Track the line start rather than asking the tokenizer per line: iterLines() yields
		// the text without its newline, so each line starts one past the previous line's end.
		let lineStart = 0;
		for ( const text of this.tokenizer.doc.iterLines() ) {
			const match = TRAILING_WHITESPACE_RE.exec( text );
			if ( match ) {
				try {
					const range = new ve.Range(
						this.getSurfaceOffsetFromSourceOffset( lineStart + match.index ),
						this.getSurfaceOffsetFromSourceOffset( lineStart + text.length )
					);
					selections.push( this.surfaceView.getSelection(
						model.getLinearFragment( range ).getSelection()
					) );
				} catch ( e ) {
					// Offsets outside the document; skip this line.
				}
			}
			lineStart += text.length + 1;
		}

		if ( !selections.length && !this.trailingWhitespaceDrawn ) {
			return;
		}
		this.surfaceView.getSelectionManager().drawSelections(
			TRAILING_WHITESPACE_GROUP, selections,
			{ showRects: false, showCustomHighlight: true }
		);
		this.trailingWhitespaceDrawn = !!selections.length;
	}

	/**
	 * Remove the trailing-whitespace highlights.
	 *
	 * @private
	 */
	clearTrailingWhitespace() {
		if ( !this.trailingWhitespaceDrawn ) {
			return;
		}
		this.surfaceView.getSelectionManager().drawSelections( TRAILING_WHITESPACE_GROUP, [] );
		this.trailingWhitespaceDrawn = false;
	}

	/**
	 * Remove every heading class this controller has set.
	 *
	 * @return {Map<number,number>} The line numbers and levels that were cleared
	 * @private
	 */
	clearHeadings() {
		const lines = this.surfaceView.getDocument().getDocumentNode().children,
			cleared = this.headingLines;
		cleared.forEach( ( level, lineNumber ) => {
			const node = lines[ lineNumber - 1 ];
			if ( node ) {
				// eslint-disable-next-line mediawiki/class-doc
				node.$element.removeClass( SECTION_CLASS_PREFIX + level );
			}
		} );
		this.headingLines = new Map();
		return cleared;
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
	 * Whether anything wants the viewport pass. Whitespace marks ride along with the syntax
	 * colors, so the pass also runs under the `no-highlight` theme when they are on.
	 *
	 * @type {boolean}
	 * @private
	 */
	get viewportPassEnabled() {
		return this.syntaxHighlightingEnabled || this.whitespaceEnabled;
	}

	/**
	 * The visible portion of the document, as source offsets.
	 *
	 * @return {Object|null} `{ from, to }`, or null if there is nothing to paint
	 * @private
	 */
	getViewportSourceRange() {
		const model = this.surface.getModel(),
			viewportRange = this.surfaceView.getViewportRange( true, VIEWPORT_PADDING );
		if ( !viewportRange ) {
			return null;
		}

		const docLength = this.tokenizer.doc.length;
		let from, to;
		try {
			from = Math.min( model.getSourceOffsetFromOffset( viewportRange.start ), docLength );
			to = Math.min( model.getSourceOffsetFromOffset( viewportRange.end ), docLength );
		} catch ( e ) {
			return null;
		}
		return to > from ? { from, to } : null;
	}

	/**
	 * Paint the spaces and tabs in the visible lines.
	 *
	 * CodeMirror draws these as a dotted glyph via background-image, which the Custom Highlight
	 * API does not support; a dotted underline is the nearest thing it can express.
	 *
	 * @param {number} srcFrom
	 * @param {number} srcTo
	 * @private
	 */
	updateWhitespace( srcFrom, srcTo ) {
		const model = this.surface.getModel(),
			doc = this.tokenizer.doc,
			selections = [],
			lastLine = doc.lineAt( srcTo ).number;

		for ( let number = doc.lineAt( srcFrom ).number; number <= lastLine; number++ ) {
			const line = doc.line( number );
			WHITESPACE_RE.lastIndex = 0;
			let match;
			while ( ( match = WHITESPACE_RE.exec( line.text ) ) !== null ) {
				try {
					const range = new ve.Range(
						this.getSurfaceOffsetFromSourceOffset( line.from + match.index ),
						this.getSurfaceOffsetFromSourceOffset(
							line.from + match.index + match[ 0 ].length
						)
					);
					selections.push( this.surfaceView.getSelection(
						model.getLinearFragment( range ).getSelection()
					) );
				} catch ( e ) {
					// Offsets outside the document; skip this run.
				}
			}
		}

		if ( !selections.length && !this.whitespaceDrawn ) {
			return;
		}
		this.surfaceView.getSelectionManager().drawSelections(
			WHITESPACE_GROUP, selections,
			{ showRects: false, showCustomHighlight: true }
		);
		this.whitespaceDrawn = !!selections.length;
	}

	/**
	 * Remove the whitespace highlights.
	 *
	 * @private
	 */
	clearWhitespace() {
		if ( !this.whitespaceDrawn ) {
			return;
		}
		this.surfaceView.getSelectionManager().drawSelections( WHITESPACE_GROUP, [] );
		this.whitespaceDrawn = false;
	}

	/**
	 * Tokenize the visible portion of the document and paint syntax colors onto the VE surface.
	 *
	 * @private
	 */
	refresh() {
		if ( !this.isActive || !this.tokenizer || !this.viewportPassEnabled ) {
			return;
		}

		const sourceRange = this.getViewportSourceRange();
		if ( !sourceRange ) {
			return;
		}
		const { from: srcFrom, to: srcTo } = sourceRange;

		if ( this.whitespaceEnabled ) {
			this.updateWhitespace( srcFrom, srcTo );
		}
		if ( !this.syntaxHighlightingEnabled ) {
			return;
		}

		const model = this.surface.getModel();
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
	 * Format a line number for VisualEditor's gutter, applying the wiki's digit transform
	 * (`wgTranslateNumerals`) like {@link CodeMirror#lineNumberingExtension}.
	 *
	 * @param {number} number
	 * @return {string}
	 * @private
	 */
	formatLineNumber( number ) {
		const string = String( number ),
			table = mw.language && mw.language.getDigitTransformTable &&
				mw.language.getDigitTransformTable();
		if ( !table || !mw.config.get( 'wgTranslateNumerals' ) ) {
			return string;
		}
		return string.replace( /[0-9]/g, ( digit ) => table[ digit ] || digit );
	}

	/**
	 * Coalesce bracket-match updates (fired on every cursor move) into one per animation frame.
	 *
	 * @private
	 */
	scheduleBracketMatch() {
		if ( this.bracketFrameHandle ) {
			return;
		}
		this.bracketFrameHandle = requestAnimationFrame( () => {
			this.bracketFrameHandle = null;
			this.updateBracketMatch();
		} );
	}

	/**
	 * Highlight the bracket and tag pairs around a collapsed cursor, painted as
	 * `matching-bracket`/`nonmatching-bracket` groups.
	 *
	 * @private
	 */
	updateBracketMatch() {
		if ( !this.isActive || !this.tokenizer || !this.bracketMatchingEnabled ) {
			return;
		}
		const model = this.surface.getModel(),
			selection = model.getSelection(),
			range = selection && selection.getCoveringRange && selection.getCoveringRange();
		// Only match at a collapsed cursor.
		if ( !range || !range.isCollapsed() ) {
			this.clearBracketMatch();
			return;
		}

		let srcPos;
		try {
			srcPos = model.getSourceOffsetFromOffset( range.start );
		} catch ( e ) {
			this.clearBracketMatch();
			return;
		}
		ensureSyntaxTree( this.tokenizer, srcPos, PARSE_BUDGET );
		// Independent, as in CodeMirror, so a tag nested inside brackets still matches.
		const matches = [
			findBracketMatch( this.tokenizer, srcPos, this.bracketConfig ),
			this.matchTag && this.matchTag( this.tokenizer, srcPos )
		].filter( Boolean );

		this.clearBracketMatch();

		const matching = [],
			nonmatching = [];
		matches.forEach( ( match ) => {
			const target = match.matched ? matching : nonmatching,
				parts = match.end ? [ match.start, match.end ] : [ match.start ];
			parts.forEach( ( part ) => {
				let dmRange;
				try {
					dmRange = model.getRangeFromSourceOffsets( part.from, part.to );
				} catch ( e ) {
					return;
				}
				target.push( this.surfaceView.getSelection(
					model.getLinearFragment( dmRange ).getSelection()
				) );
			} );
		} );

		const selectionManager = this.surfaceView.getSelectionManager();
		[ [ 'matching-bracket', matching ], [ 'nonmatching-bracket', nonmatching ] ].forEach(
			( [ name, selections ] ) => {
				if ( selections.length ) {
					selectionManager.drawSelections(
						name, selections, { showRects: false, showCustomHighlight: true }
					);
					this.bracketGroups.add( name );
				}
			}
		);
	}

	/**
	 * Remove any drawn bracket-match highlight groups.
	 *
	 * @private
	 */
	clearBracketMatch() {
		const selectionManager = this.surfaceView.getSelectionManager();
		this.bracketGroups.forEach( ( name ) => selectionManager.drawSelections( name, [] ) );
		this.bracketGroups.clear();
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
