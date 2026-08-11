const {
	Direction,
	EditorState,
	EditorView,
	LanguageSupport
} = require( 'ext.CodeMirror.lib' );
const CodeMirror = require( 'ext.CodeMirror' );

/**
 * CodeMirror integration for the VisualEditor
 * {@link https://www.mediawiki.org/wiki/Special:MyLanguage/2017_wikitext_editor 2017 wikitext editor}.
 *
 * @extends CodeMirror
 */
class CodeMirrorVisualEditor extends CodeMirror {
	/**
	 * @param {ve.ui.Surface} surface
	 * @param {LanguageSupport} langSupport
	 */
	constructor( surface, langSupport = [] ) {
		super( surface, langSupport );

		/**
		 * The ContentEditable surface.
		 *
		 * @type {ve.ce.Surface}
		 */
		this.surfaceView = this.surface.getView();
	}

	/**
	 * The VisualEditor surface.
	 *
	 * @type {ve.ui.Surface}
	 */
	get surface() {
		return this.textarea;
	}

	/**
	 * @inheritDoc
	 */
	get readOnly() {
		return this.surface.getModel().isReadOnly();
	}

	/**
	 * Extensions supported by the 2017 wikitext editor.
	 * Do *not* include Extensions that make changes to the document text, or visually
	 * change the placement of text. These are what the page menu's preferences tool
	 * ({@link ve.ui.CodeMirrorPreferencesTool}) offers there.
	 *
	 * @inheritDoc
	 */
	get extensionRegistryDefaults() {
		const extensions = {
			activeLine: this.activeLineExtension,
			bracketMatching: this.bracketMatchingExtension,
			lineNumbering: this.lineNumberingExtension,
			trailingWhitespace: this.trailingWhitespaceExtension,
			whitespace: this.whitespaceExtension
		};
		// DiscussionTools has no line numbers, so don't offer the preference there either.
		if ( this.surface.getTarget().constructor.name === 'CommentTarget' ) {
			delete extensions.lineNumbering;
		}
		return extensions;
	}

	/**
	 * The same constraint as {@link CodeMirrorVisualEditor#extensionRegistryDefaults}, applied
	 * to anything registered after construction. `highlightRefs` and `theme` are permitted but
	 * not seeded there, as the language pack and {@link CodeMirrorThemes} register those once
	 * there is a view.
	 *
	 * @inheritDoc
	 */
	get supportedExtensions() {
		return [
			'activeLine',
			'bracketMatching',
			'highlightRefs',
			'lineNumbering',
			'theme',
			'trailingWhitespace',
			'whitespace'
		];
	}

	/**
	 * @inheritDoc
	 */
	get defaultExtensions() {
		return [
			this.contentAttributesExtension,
			this.editorAttributesExtension,
			this.heightExtension,
			this.updateExtension,
			this.dirExtension,
			this.preferences.extension,
			EditorState.readOnly.of( this.readOnly ),
			this.langExtension,
			EditorView.theme( {
				'.cm-content': {
					lineHeight: 1.5
				},
				'&': {
					padding: window.getComputedStyle(
						this.surfaceView.$attachedRootNode[ 0 ]
					).padding
				}
			} )
		];
	}

	/**
	 * @inheritDoc
	 */
	get heightExtension() {
		return EditorView.theme( {
			'&': {
				height: '100%'
			}
		} );
	}

	/**
	 * @inheritDoc
	 */
	get contentAttributesExtension() {
		// Add colorblind mode if preference is set.
		// This currently is only to be used for the MediaWiki markup language.
		const useColorBlind = mw.user.options.get( 'usecodemirror-colorblind' ) &&
			mw.config.get( 'cmMode' ) === 'mediawiki';

		return EditorView.contentAttributes.of( {
			class: useColorBlind ? 'cm-mw-colorblind-colors' : '',
			spellcheck: 'true',
			// Disable tabbing to content editable (T412827)
			inert: 'true',
			// Fallback for browsers not supporting inert
			tabindex: '-1'
		} );
	}

	/**
	 * Preferences this integration honours, for {@link ve.ui.CodeMirrorPreferencesPage}.
	 *
	 * @type {string[]}
	 */
	get supportedPreferences() {
		return this.extensionRegistry.names;
	}

	/**
	 * Apply a preference to the running editor. toggle() reconfigures from the value map when
	 * given a string, so this covers both switches and choices.
	 *
	 * @param {string} name
	 * @param {PrefValue} value
	 */
	applyPreference( name, value ) {
		this.extensionRegistry.toggle( name, this.view, value );
		// Adding or removing the gutter moves where CodeMirror's text starts.
		if ( name === 'lineNumbering' && this.isActive ) {
			this.updateGutterWidth( this.surfaceView.getDocument().getDir() );
		}
	}

	/**
	 * @inheritDoc
	 */
	getSourceContents() {
		return this.surface.getDom();
	}

	/**
	 * @inheritDoc
	 */
	addToDOM( extensions ) {
		this.container = this.surface.getTarget().$element[ 0 ];
		// Create the EditorState of CodeMirror with contents of the original textarea.
		const state = this.getNewEditorState( extensions );
		// Instantiate the view, adding it to the DOM
		this.view = new EditorView( { state, parent: this.container } );
		this.surfaceView.$documentNode.append( this.view.dom );
	}

	/**
	 * @inheritDoc
	 */
	initialize( extensions = this.defaultExtensions ) {
		if ( this.surface.getMode() !== 'source' ) {
			mw.log.warn( '[CodeMirror] Attempted to initialize CodeMirrorVisualEditor in non-source mode.' );
			return;
		}
		super.initialize( extensions );
	}

	/**
	 * @inheritDoc
	 */
	addEditRecoveryHandler() {}

	/**
	 * @inheritDoc
	 */
	addTextAreaJQueryHook() {}

	/**
	 * @inheritDoc
	 */
	addFormSubmitHandler() {}

	/**
	 * Focus is always given to the VE surface, which relays it to CodeMirror.
	 *
	 * @inheritDoc
	 */
	focus() {
		this.surfaceView.focus();
	}

	/**
	 * @inheritDoc
	 */
	get hasFocus() {
		return this.surfaceView.isFocused();
	}

	/**
	 * @inheritDoc
	 */
	activate() {
		super.activate();

		// Force infinite viewport in CodeMirror to prevent misalignment of
		// the VE surface and the CodeMirror view. See T357482#10076432.
		this.view.viewState.printing = true;

		const profile = $.client.profile();
		const supportsTransparentText = 'WebkitTextFillColor' in document.body.style &&
			// Disable on Firefox+OSX (T175223)
			!( profile.layout === 'gecko' && profile.platform === 'mac' );

		this.surfaceView.$documentNode.addClass(
			supportsTransparentText ?
				've-ce-documentNode-codeEditor-webkit-hide' :
				've-ce-documentNode-codeEditor-hide'
		);

		// The VE/CM overlay technique only works with monospace fonts
		// (as we use width-changing bold as a highlight) so revert any editfont user preference
		this.surfaceView.$element.removeClass( 'mw-editfont-sans-serif mw-editfont-serif' )
			.addClass( 'mw-editfont-monospace' );

		// Account for the gutter width in the margin.
		this.updateGutterWidth( this.surfaceView.getDocument().getDir() );

		// As the action is regenerated each time,
		// we need to track the listeners for later disconnection.

		/**
		 * @type {Function}
		 * @private
		 */
		this.transactionListener = this.onDocumentPrecommit.bind( this );
		this.surface.getModel().getDocument().on( 'precommit', this.transactionListener );
		/**
		 * @type {Function}
		 * @private
		 */
		this.selectListener = this.onSelect.bind( this );
		this.surface.getModel().on( 'select', this.selectListener );
		/**
		 * @type {Function}
		 * @private
		 */
		this.positionListener = this.onPosition.bind( this );
		this.surfaceView.on( 'position', this.positionListener );

		// Sync document directionality changes to CodeMirror.
		this.onPosition();
	}

	/**
	 * There is no hidden textarea, and VE owns the selection and scroll position.
	 *
	 * @inheritDoc
	 */
	restoreSelectionAndScrollPosition() {}

	/**
	 * @inheritDoc
	 */
	syncEditorContentsToSource() {}

	/**
	 * @inheritDoc
	 */
	syncSelectionAndScrollPosition() {}

	/**
	 * @inheritDoc
	 */
	deactivate() {
		super.deactivate();

		this.surfaceView.$documentNode.removeClass(
			've-ce-documentNode-codeEditor-webkit-hide ve-ce-documentNode-codeEditor-hide'
		);

		// Restore edit-font
		// eslint-disable-next-line mediawiki/class-doc
		this.surfaceView.$element.removeClass( 'mw-editfont-monospace' )
			.addClass( 'mw-editfont-' + mw.user.options.get( 'editfont' ) );

		// Reset gutter.
		const margins = {
			'margin-left': '',
			'margin-right': ''
		};
		this.surfaceView.$documentNode.css( margins );

		this.surface.getModel().getDocument().off( 'precommit', this.transactionListener );
		this.surface.getModel().off( 'select', this.selectListener );
		this.surfaceView.off( 'position', this.positionListener );
	}

	/**
	 * Log usage of CodeMirror to the VisualEditorFeatureUse schema.
	 *
	 * @see https://phabricator.wikimedia.org/T373710
	 * @see https://meta.wikimedia.org/wiki/Schema:VisualEditorFeatureUse
	 * @see https://www.mediawiki.org/wiki/VisualEditor/FeatureUse_data_dictionary
	 * @inheritDoc
	 */
	logEditFeature( action ) {
		mw.track( 'visualEditorFeatureUse', { feature: 'codemirror', action } );
	}

	/**
	 * @inheritDoc
	 */
	setupFeatureLogging() {}

	/**
	 * Update margins to account for the CodeMirror gutter.
	 *
	 * @param {string} dir Document direction
	 * @private
	 */
	updateGutterWidth( dir ) {
		const gutter = this.view.dom.querySelector( '.cm-gutters' );
		// Zero when line numbering is disabled: the offsets have to be cleared rather than
		// left alone, or the surface stays indented by a gutter that is no longer there.
		const guttersWidth = gutter ? gutter.getBoundingClientRect().width : 0;
		const margins = {
			'margin-left': dir === 'rtl' ? 0 : guttersWidth,
			'margin-right': dir === 'rtl' ? guttersWidth : 0
		};
		this.surfaceView.$documentNode.css( margins );
		// Also update width of .cm-content due to apparent Chromium bug.
		this.view.contentDOM.style.width = guttersWidth ?
			'calc(100% - ' + guttersWidth + 'px)' :
			'';
	}

	/**
	 * Sync document directionality changes to CodeMirror.
	 *
	 * @private
	 */
	onPosition() {
		const veDir = this.surfaceView.getDocument().getDir();
		const cmDir = this.view.textDirection === Direction.LTR ? 'ltr' : 'rtl';

		if ( veDir !== cmDir ) {
			this.view.dispatch( {
				effects: this.dirCompartment.reconfigure(
					EditorView.editorAttributes.of( { dir: veDir } )
				)
			} );
			this.updateGutterWidth( veDir );
		}
	}

	/**
	 * Handle select events from the surface model.
	 *
	 * @param {ve.dm.Selection} selection
	 * @private
	 */
	onSelect( selection ) {
		const range = selection.getCoveringRange();

		if ( !range ) {
			return;
		}

		const model = this.surface.getModel(),
			// T382769: the selection range from `textSelection( 'setContents' )`
			// exceeds the document length.
			clamp = ( offset ) => Math.min(
				model.getSourceOffsetFromOffset( offset ),
				this.view.state.doc.length
			);

		// Mirror the whole selection, not just a collapsed cursor: highlightActiveLine marks
		// the line at the head. Bracket matching skips non-empty ranges of its own accord, so
		// it is unaffected.
		this.view.dispatch( {
			selection: {
				anchor: clamp( range.from ),
				head: clamp( range.to )
			}
		} );
	}

	/**
	 * Handle precommit events from the document.
	 *
	 * The document is still in it's 'old' state before the transaction
	 * has been applied at this point.
	 *
	 * @param {ve.dm.Transaction} tx
	 * @private
	 */
	onDocumentPrecommit( tx ) {
		const replacements = [],
			model = this.surface.getModel(),
			store = model.getDocument().getStore();
		let offset = 0;

		tx.operations.forEach( ( op ) => {
			if ( op.type === 'retain' ) {
				offset += op.length;
			} else if ( op.type === 'replace' ) {
				replacements.push( {
					from: model.getSourceOffsetFromOffset( offset ),
					to: model.getSourceOffsetFromOffset( offset + op.remove.length ),
					insert: new ve.dm.ElementLinearData( store, op.insert ).getSourceText()
				} );
				offset += op.remove.length;
			}
		} );

		// Apply replacements in reverse to avoid having to shift offsets
		for ( let i = replacements.length - 1; i >= 0; i-- ) {
			// T382769: the replacement range from `textSelection( 'setContents' )`
			// exceeds the document length by one character and inserts an extra newline
			const { from, to, insert } = replacements[ i ],
				isSetContents = to === this.view.state.doc.length + 1 &&
					insert.endsWith( '\n' );
			this.view.dispatch( {
				changes: {
					from,
					to: isSetContents ? to - 1 : to,
					insert: isSetContents ? insert.slice( 0, -1 ) : insert
				}
			} );
		}

		this.updateGutterWidth( this.surfaceView.getDocument().getDir() );
	}
}

/**
 * @module ext.CodeMirror.visualEditor
 * @description
 * This module provides CodeMirror integration for the 2017 wikitext editor that
 * is part of the VisualEditor extension. It exports the {@link CodeMirrorVisualEditor} class.
 * To be usable beyond a plain text editor, you will need to pass in a language mode to the
 * constructor. See {@link CodeMirrorVisualEditor} for more information.
 * @see CodeMirrorVisualEditor
 */
module.exports = CodeMirrorVisualEditor;
