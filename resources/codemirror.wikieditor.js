const {
	EditorView,
	Extension,
	LanguageSupport,
	openSearchPanel
} = require( 'ext.CodeMirror.v6.lib' );
const CodeMirror = require( 'ext.CodeMirror.v6' );

/**
 * CodeMirror integration with
 * [WikiEditor](https://www.mediawiki.org/wiki/Special:MyLanguage/Extension:WikiEditor).
 *
 * Use this class if you want WikiEditor's toolbar. If you don't need the toolbar,
 * using {@link CodeMirror} directly will be considerably more efficient.
 *
 * @example
 * mw.loader.using( [
 *   'ext.wikiEditor',
 *   'ext.CodeMirror.v6.WikiEditor',
 *   'ext.CodeMirror.v6.mode.mediawiki'
 * ] ).then( ( require ) => {
 *   mw.addWikiEditor( myTextarea );
 *   const CodeMirrorWikiEditor = require( 'ext.CodeMirror.v6.WikiEditor' );
 *   const mediawikiLang = require( 'ext.CodeMirror.v6.mode.mediawiki' );
 *   const cmWe = new CodeMirrorWikiEditor( myTextarea, mediawikiLang() );
 *   cmWe.initialize();
 * } );
 * @class
 * @extends CodeMirror
 */
class CodeMirrorWikiEditor extends CodeMirror {
	/**
	 * @constructor
	 * @param {HTMLTextAreaElement|jQuery|string} textarea The textarea to replace with CodeMirror.
	 * @param {LanguageSupport|Extension} [langExtension] Language support and its extension(s).
	 * @stable to call and override
	 */
	constructor( textarea, langExtension = [] ) {
		super( textarea, langExtension );
		/**
		 * The [Realtime Preview](https://w.wiki/Cgpp) handler.
		 *
		 * @type {Function|null}
		 */
		this.realtimePreviewHandler = null;
		/**
		 * The `ext.WikiEditor.realtimepreview.enable` hook handler.
		 *
		 * @type {Function|null}
		 */
		this.realtimePreviewEnableHandler = null;
		/**
		 * The `ext.WikiEditor.realtimepreview.disable` hook handler.
		 *
		 * @type {Function|null}
		 */
		this.realtimePreviewDisableHandler = null;
		/**
		 * The WikiEditor search button, which is usurped to open the CodeMirror search panel.
		 *
		 * @type {jQuery|null}
		 */
		this.$searchBtn = null;
		/**
		 * The old WikiEditor search button, to be restored if CodeMirror is disabled.
		 *
		 * @type {jQuery|null}
		 */
		this.$oldSearchBtn = null;
	}

	/**
	 * @inheritDoc
	 */
	get defaultExtensions() {
		return [
			...super.defaultExtensions,
			EditorView.updateListener.of( ( update ) => {
				if ( update.docChanged && typeof this.realtimePreviewHandler === 'function' ) {
					this.realtimePreviewHandler();
				}
			} )
		];
	}

	/**
	 * @inheritDoc
	 */
	initialize( extensions = this.defaultExtensions ) {
		if ( this.view ) {
			// Already initialized.
			return;
		}

		const context = this.$textarea.data( 'wikiEditor-context' );
		const toolbar = context && context.modules && context.modules.toolbar;

		// Guard against something having removed WikiEditor (T271457)
		if ( !toolbar ) {
			return;
		}

		// Remove the initial toggle button that may have been added by the init script.
		this.$textarea.wikiEditor( 'removeFromToolbar', {
			section: 'main',
			group: 'codemirror'
		} );

		// Add 'Syntax' button to main toolbar.
		this.$textarea.wikiEditor(
			'addToToolbar',
			{
				section: 'main',
				groups: {
					codemirror: {
						tools: {
							CodeMirror: {
								type: 'element',
								element: () => {
									// OOUI has already been loaded by WikiEditor.
									const button = new OO.ui.ToggleButtonWidget( {
										label: mw.msg( 'codemirror-toggle-label-short' ),
										title: mw.msg( 'codemirror-toggle-label' ),
										icon: 'syntax-highlight',
										value: !this.isActive,
										framed: false,
										classes: [ 'tool', 'cm-mw-toggle-wikieditor' ]
									} );
									button.on( 'change', () => this.toggle() );
									return button.$element;
								}
							}
						}
					}
				}
			}
		);

		// Set the ID of the CodeMirror button for styling.
		const codeMirrorButton = toolbar.$toolbar[ 0 ].querySelector( '.tool[rel=CodeMirror]' );
		codeMirrorButton.id = 'mw-editbutton-codemirror';

		// Hide non-applicable buttons until WikiEditor better supports a read-only mode (T188817).
		if ( this.readOnly ) {
			context.$ui.addClass( 'ext-codemirror-readonly' );
		}

		super.initialize( extensions );

		this.fireSwitchHook();
	}

	/**
	 * @private
	 */
	fireSwitchHook() {
		if ( !this.switchHook ) {
			/**
			 * @type {Hook}
			 * @private
			 */
			this.switchHook = mw.hook( 'ext.CodeMirror.switch' );
			this.switchHook.deprecate( 'Use "ext.CodeMirror.toggle" instead.' );
		}
		/**
		 * Called after CodeMirror is enabled or disabled in WikiEditor.
		 *
		 * @event CodeMirrorWikiEditor~'ext.CodeMirror.switch'
		 * @param {boolean} enabled Whether CodeMirror is enabled.
		 * @param {jQuery} $textarea The current "editor", either the
		 *   original textarea or the `.cm-editor` element.
		 * @deprecated since MediaWiki 1.44, use
		 *   {@link event:'ext.CodeMirror.toggle' ext.CodeMirror.toggle} instead.
		 */
		this.switchHook.fire(
			this.isActive,
			this.isActive ? $( this.view.dom ) : this.$textarea
		);
	}

	/**
	 * @inheritDoc
	 */
	toggle( force ) {
		super.toggle( force );
		this.fireSwitchHook();
	}

	/**
	 * @inheritDoc
	 */
	activate() {
		super.activate();

		CodeMirror.setCodeMirrorPreference( true );
		this.addRealtimePreviewHandler();

		// Hijack the search button to open the CodeMirror search panel
		// instead of the WikiEditor search dialog.
		// eslint-disable-next-line no-jquery/no-global-selector
		this.$searchBtn = $( '.wikiEditor-ui .group-search .tool' );
		this.$oldSearchBtn = this.$searchBtn.clone( true );
		this.$searchBtn.find( 'a' )
			.off( 'click keydown keypress' )
			.on( 'click keydown', ( e ) => {
				if ( e.type === 'click' || ( e.type === 'keydown' && e.key === 'Enter' ) ) {
					openSearchPanel( this.view );
					e.preventDefault();
				}
			} );

		// Add a 'Settings' button to the search group of the toolbar, in the 'Advanced' section.
		this.$textarea.wikiEditor(
			'addToToolbar',
			{
				section: 'advanced',
				groups: {
					codemirror: {
						tools: {
							CodeMirrorPreferences: {
								type: 'element',
								element: () => {
									const button = new OO.ui.ButtonWidget( {
										title: mw.msg( 'codemirror-prefs-title' ),
										icon: 'settings',
										framed: false,
										classes: [ 'tool' ]
									} );
									button.on( 'click',
										() => this.preferences.toggle( this.view, true )
									);
									return button.$element;
								}
							}
						}
					}
				}
			}
		);
	}

	/**
	 * @inheritDoc
	 */
	deactivate() {
		super.deactivate();

		CodeMirror.setCodeMirrorPreference( false );

		// Restore original search button.
		this.$searchBtn.replaceWith( this.$oldSearchBtn );

		// Remove the CodeMirror preferences button from the toolbar.
		this.$textarea.wikiEditor( 'removeFromToolbar', {
			section: 'advanced',
			group: 'codemirror'
		} );
	}

	/**
	 * @inheritDoc
	 */
	destroy() {
		super.destroy();

		this.$textarea.wikiEditor( 'removeFromToolbar', {
			section: 'main',
			group: 'codemirror'
		} );

		if ( this.readOnly ) {
			this.$textarea.data( 'wikiEditor-context' ).$ui.removeClass( 'ext-codemirror-readonly' );
		}

		this.switchHook = null;
	}

	/**
	 * Log usage of CodeMirror to the VisualEditorFeatureUse schema.
	 * Reimplements ext.wikiEditor's logEditFeature method (GPL-2.0+), which isn't exported.
	 *
	 * @see https://phabricator.wikimedia.org/T373710
	 * @see https://meta.wikimedia.org/wiki/Schema:VisualEditorFeatureUse
	 * @see https://www.mediawiki.org/wiki/VisualEditor/FeatureUse_data_dictionary
	 * @inheritDoc
	 */
	logEditFeature( action ) {
		if ( mw.config.get( 'wgMFMode' ) !== null ) {
			// Visiting a ?action=edit URL can, depending on user settings, result
			// in the MobileFrontend overlay appearing on top of WikiEditor. In
			// these cases, don't log anything.
			return;
		}
		mw.track( 'visualEditorFeatureUse', {
			feature: 'codemirror',
			action
		} );
	}

	/**
	 * Adds the Realtime Preview handler. Realtime Preview reads from the textarea
	 * via jQuery.textSelection, which will bubble up to CodeMirror automatically.
	 *
	 * @private
	 */
	addRealtimePreviewHandler() {
		this.addMwHook( 'ext.WikiEditor.realtimepreview.enable', ( realtimePreview ) => {
			this.realtimePreviewHandler = realtimePreview.getEventHandler().bind( realtimePreview );
		} );
		this.addMwHook( 'ext.WikiEditor.realtimepreview.disable', () => {
			this.realtimePreviewHandler = null;
		} );
	}
}

module.exports = CodeMirrorWikiEditor;
