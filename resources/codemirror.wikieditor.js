const {
	EditorView,
	Extension,
	LanguageSupport,
	StateCommand,
	indentLess,
	indentMore,
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
 * const require = await mw.loader.using( [
 *   'ext.wikiEditor', 'ext.CodeMirror.v6.WikiEditor', 'ext.CodeMirror.v6.mode.mediawiki'
 * ] );
 * mw.addWikiEditor( myTextarea );
 * const CodeMirrorWikiEditor = require( 'ext.CodeMirror.v6.WikiEditor' );
 * const mediawikiLang = require( 'ext.CodeMirror.v6.mode.mediawiki' );
 * const cmWe = new CodeMirrorWikiEditor( myTextarea, mediawikiLang() );
 * cmWe.initialize();
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
			// Already initialized, let parent handle it.
			return super.initialize( extensions );
		}

		const toolbar = this.context && this.context.modules && this.context.modules.toolbar;

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
		this.$textarea.wikiEditor( 'addToToolbar', {
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
		} );

		// Set the ID of the CodeMirror button for styling.
		const codeMirrorButton = toolbar.$toolbar[ 0 ].querySelector( '.tool[rel=CodeMirror]' );
		codeMirrorButton.id = 'mw-editbutton-codemirror';

		// Hide non-applicable buttons until WikiEditor better supports a read-only mode (T188817).
		if ( this.readOnly ) {
			this.context.$ui.addClass( 'ext-codemirror-readonly' );
		}

		// Similarly, add a unique CSS for the content model.
		// CSS classes used here may include but are not limited to:
		// * ext-codemirror-mediawiki
		// * ext-codemirror-javascript
		// * ext-codemirror-css
		// * ext-codemirror-json
		this.context.$ui.addClass(
			`ext-codemirror-${ ( mw.config.get( 'cmMode' ) || this.contentModel ).toLowerCase() }`
		);

		super.initialize( extensions );
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
					this.search.openPanel( this.view );
					e.preventDefault();
				}
			} );

		if ( this.contentModel === 'wikitext' ) {
			// Add a 'Settings' button to the search group, in the 'Advanced' section.
			this.$textarea.wikiEditor( 'addToToolbar', {
				section: 'advanced',
				groups: {
					codemirror: {
						tools: {
							CodeMirrorPreferences: this.preferencesTool
						}
					}
				}
			} );
		} else {
			this.addCodeFormattingButtonsToToolbar();
		}
	}

	/**
	 * @inheritDoc
	 */
	deactivate() {
		super.deactivate();

		CodeMirror.setCodeMirrorPreference( false );

		if ( this.contentModel === 'wikitext' ) {
			// Restore original search button.
			this.$searchBtn.replaceWith( this.$oldSearchBtn );

			// Remove the CodeMirror preferences button from the advanced section.
			this.$textarea.wikiEditor( 'removeFromToolbar', {
				section: 'advanced',
				group: 'codemirror'
			} );
		} else {
			// Remove the CodeMirror preferences button from the secondary section.
			this.$textarea.wikiEditor( 'removeFromToolbar', {
				section: 'secondary',
				group: 'codemirror'
			} );
			// Remove the main toolbar buttons that we added.
			for ( const group of [ 'format', 'preferences', 'search' ] ) {
				this.$textarea.wikiEditor( 'removeFromToolbar', {
					section: 'main',
					group: `codemirror-${ group }`
				} );
			}
		}
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
			this.context.$ui.removeClass( 'ext-codemirror-readonly' );
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
			action,
			// eslint-disable-next-line camelcase
			editor_interface: 'wikitext',
			// FIXME T249944
			platform: 'desktop',
			integration: 'page'
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

	/**
	 * For use in non-wikitext content models.
	 *
	 * @private
	 */
	addCodeFormattingButtonsToToolbar() {
		this.$textarea.wikiEditor( 'addToToolbar', { section: 'main', groups: {
			'codemirror-format': {
				tools: {
					indentMore: this.getTool( 'indent', () => indentMore( this.stateCommand ) ),
					indentLess: this.getTool( 'outdent', () => indentLess( this.stateCommand ) )
				}
			},
			'codemirror-preferences': {
				tools: {
					whitespace: this.getToggleTool( 'whitespace', 'pilcrow' ),
					lineWrapping: this.getToggleTool( 'lineWrapping', 'wrapping' ),
					autocomplete: this.getToggleTool( 'autocomplete', 'check-all' )
				}
			},
			'codemirror-search': {
				tools: {
					gotoLine: this.getTool(
						'gotoLine',
						() => this.gotoLine.run( this.view ),
						'codemirror-goto-line'
					),
					search: this.getTool(
						'search',
						() => openSearchPanel( this.view ),
						'codemirror-keymap-find',
						'articleSearch'
					)
				}
			}
		} } );
		this.$textarea.wikiEditor( 'addToToolbar', {
			section: 'secondary',
			groups: {
				codemirror: {
					tools: {
						CodeMirrorPreferences: this.preferencesTool
					}
				}
			}
		} );
	}

	/**
	 * The WikiEditor context.
	 *
	 * @type {Object}
	 */
	get context() {
		return this.$textarea.data( 'wikiEditor-context' );
	}

	/**
	 * @type {StateCommand}
	 * @private
	 */
	get stateCommand() {
		return {
			state: this.view.state,
			dispatch: this.view.dispatch.bind( this.view )
		};
	}

	/**
	 * Get the WikiEditor configuration for a tool that runs a {@link Command}.
	 *
	 * @param {string} name
	 * @param {Function|Command} command
	 * @param {string} [label]
	 * @param {string} [icon]
	 * @return {Object}
	 * @private
	 */
	getTool( name, command, label, icon ) {
		return {
			// Possible messages include but are not limited to:
			// * codemirror-keymap-preferences
			// * codemirror-keymap-indent
			// * codemirror-keymap-outdent
			// * codemirror-keymap-goto-line
			// * codemirror-keymap-find
			label: mw.msg( label || `codemirror-keymap-${ name.toLowerCase() }` ),
			type: 'button',
			oouiIcon: icon || name,
			action: {
				type: 'callback',
				execute: command
			}
		};
	}

	/**
	 * Get the WikiEditor configuration for a toggle button that controls a preference.
	 * This will toggle the extension with the given `name`.
	 *
	 * @param {string} name
	 * @param {string} icon
	 * @return {Object}
	 * @private
	 */
	getToggleTool( name, icon ) {
		return {
			label: mw.msg( `codemirror-prefs-${ name.toLowerCase() }` ),
			type: 'element',
			element: () => {
				// OOUI has already been loaded by WikiEditor.
				const button = new OO.ui.ToggleButtonWidget( {
					icon,
					value: this.preferences.getPreference( name ),
					framed: false,
					classes: [ 'tool' ],
					// Possible messages include but are not limited to:
					// * codemirror-prefs-whitespace
					// * codemirror-prefs-lineWrapping
					// * codemirror-prefs-autocomplete
					title: mw.msg( `codemirror-prefs-${ name.toLowerCase() }` )
				} );
				button.on( 'click', () => this.preferences.toggleExtension( name, this.view ) );
				return button.$element;
			}
		};
	}

	/**
	 * The WikiEditor configuration for the preferences tool.
	 *
	 * @type {Object}
	 * @private
	 */
	get preferencesTool() {
		return this.getTool(
			'CodeMirrorPreferences',
			() => this.preferences.toggle( this.view, true ),
			'codemirror-keymap-preferences',
			'settings'
		);
	}
}

module.exports = CodeMirrorWikiEditor;
