const {
	Direction,
	EditorState,
	EditorView,
	LanguageSupport
} = require( 'ext.CodeMirror.v6.lib' );
const CodeMirror = require( 'ext.CodeMirror.v6' );

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
		// Let the content editable mimic the textarea.
		super( surface.getView().$attachedRootNode[ 0 ], langSupport );

		/**
		 * @inheritDoc
		 * @override
		 */
		this.surface = surface;
		/**
		 * The ContentEditable surface.
		 *
		 * @type {ve.ce.Surface}
		 */
		this.surfaceView = surface.getView();
		/**
		 * @inheritDoc
		 * @override
		 */
		this.readOnly = this.surface.getModel().isReadOnly();
		// TODO: lineNumbering override doesn't work because it's ran before the constructor.
		//   To be revisited once CodeMirrorVisualEditor has its own CodeMirrorPreferences implementation
		//   (it should use lockPreference() to disable line numbering).
		// Disable line numbering in DiscussionTools.
		if ( this.surface.getTarget().constructor.name === 'CommentTarget' ) {
			delete this.extensionRegistry.extensions.lineNumbering;
			delete this.extensionRegistry.compartments.lineNumbering;
		}
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
			spellcheck: 'true'
		} );
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
	addEditRecoveredHandler() {}

	/**
	 * @inheritDoc
	 */
	addTextAreaJQueryHook() {}

	/**
	 * @inheritDoc
	 */
	addFormSubmitHandler() {}

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

		// Set focus on the surface view.
		this.surfaceView.focus();

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
		this.surfaceView.$documentNode.css( {
			'margin-left': '',
			'margin-right': ''
		} );

		this.surface.getModel().getDocument().off( 'precommit', this.transactionListener );
		this.surface.getModel().off( 'select', this.selectListener );
		this.surfaceView.off( 'position', this.positionListener );

		// Set focus on the surface view.
		this.surfaceView.focus();
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
		if ( !gutter ) {
			// Line numbering is disabled.
			return;
		}
		const guttersWidth = gutter.getBoundingClientRect().width;
		this.surfaceView.$documentNode.css( {
			'margin-left': dir === 'rtl' ? 0 : guttersWidth,
			'margin-right': dir === 'rtl' ? guttersWidth : 0
		} );
		// Also update width of .cm-content due to apparent Chromium bug.
		this.view.contentDOM.style.width = 'calc(100% - ' + guttersWidth + 'px)';
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

		// Do not re-trigger bracket matching as long as something is selected
		if ( !range || !range.isCollapsed() ) {
			return;
		}

		// T382769: the selection range from `textSelection( 'setContents' )`
		// exceeds the document length.
		const offset = Math.min(
			this.surface.getModel().getSourceOffsetFromOffset( range.from ),
			this.view.state.doc.length
		);

		this.view.dispatch( {
			selection: {
				anchor: offset,
				head: offset
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
 * @module ext.CodeMirror.v6.visualEditor
 * @description
 * This module provides CodeMirror integration for the 2017 wikitext editor that
 * is part of the VisualEditor extension. It exports the {@link CodeMirrorVisualEditor} class.
 * To be usable beyond a plain text editor, you will need to pass in a language mode to the
 * constructor. See {@link CodeMirrorVisualEditor} for more information.
 * @see CodeMirrorVisualEditor
 */
module.exports = CodeMirrorVisualEditor;
