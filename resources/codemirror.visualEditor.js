const {
	Direction,
	EditorState,
	EditorView,
	Extension,
	LanguageSupport
} = require( 'ext.CodeMirror.v6.lib' );
const CodeMirror = require( 'ext.CodeMirror.v6' );

class CodeMirrorVisualEditor extends CodeMirror {
	/**
	 * @param {ve.ui.Surface} surface
	 * @param {LanguageSupport|Extension} langExtension
	 */
	constructor( surface, langExtension = [] ) {
		// Let the content editable mimic the textarea.
		super( surface.getView().$attachedRootNode[ 0 ], langExtension );

		/**
		 * The VisualEditor surface CodeMirror is bound to.
		 *
		 * @type {ve.ui.Surface}
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
			mw.config.get( 'wgPageContentModel' ) === 'wikitext';

		return EditorView.contentAttributes.of( {
			class: useColorBlind ? 'cm-mw-colorblind-colors' : '',
			spellcheck: 'true'
		} );
	}

	/**
	 * @inheritDoc
	 */
	initialize( extensions = this.defaultExtensions ) {
		mw.hook( 'ext.CodeMirror.initialize' ).fire( this.surface );
		this.initExtensions = extensions;
		this.activate();
		mw.hook( 'ext.CodeMirror.ready' ).fire( this );
	}

	/**
	 * @inheritDoc
	 */
	activate() {
		super.activate();

		CodeMirror.setCodeMirrorPreference( true );

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

		CodeMirror.setCodeMirrorPreference( false );

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
	setupFeatureLogging() {
		this.addMwHook( 'ext.CodeMirror.preferences.apply', ( prefName, enabled ) => {
			// Log only when in-use, not when it's toggled.
			if ( enabled ) {
				this.logEditFeature( `prefs-${ prefName }` );
			}
		} );
	}

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

module.exports = CodeMirrorVisualEditor;
