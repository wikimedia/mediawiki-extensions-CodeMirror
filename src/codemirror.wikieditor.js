import CodeMirror from './codemirror';
import { EditorSelection, Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { LanguageSupport } from '@codemirror/language';

/**
 * CodeMirror integration with
 * [WikiEditor](https://www.mediawiki.org/wiki/Special:MyLanguage/Extension:WikiEditor).
 *
 * Use this class if you want WikiEditor's toolbar. If you don't need the toolbar,
 * using {@link CodeMirror} directly will be considerably more efficient.
 *
 * @extends CodeMirror
 */
class CodeMirrorWikiEditor extends CodeMirror {
	/**
	 * @constructor
	 * @param {jQuery} $textarea The textarea to replace with CodeMirror.
	 * @param {LanguageSupport|Extension} langExtension Language support and its extension(s).
	 * @stable to call and override
	 */
	constructor( $textarea, langExtension ) {
		super( $textarea );
		/**
		 * Language support and its extension(s).
		 *
		 * @type {LanguageSupport|Extension}
		 */
		this.langExtension = langExtension;
		/**
		 * Whether CodeMirror is currently enabled.
		 *
		 * @type {boolean}
		 */
		this.useCodeMirror = mw.user.options.get( 'usecodemirror' ) > 0;
		/**
		 * The [Realtime Preview](https://w.wiki/9XgX) handler.
		 *
		 * @type {Function|null}
		 */
		this.realtimePreviewHandler = null;
	}

	/**
	 * @inheritDoc
	 */
	setCodeMirrorPreference( prefValue ) {
		// Save state for function updateToolbarButton()
		this.useCodeMirror = prefValue;
		super.setCodeMirrorPreference( prefValue );
	}

	/**
	 * Replaces the default textarea with CodeMirror.
	 *
	 * @fires CodeMirrorWikiEditor~'ext.CodeMirror.switch'
	 * @stable to call
	 */
	enableCodeMirror() {
		// If CodeMirror is already loaded, abort.
		if ( this.view ) {
			return;
		}

		const selectionStart = this.$textarea.prop( 'selectionStart' ),
			selectionEnd = this.$textarea.prop( 'selectionEnd' ),
			scrollTop = this.$textarea.scrollTop(),
			hasFocus = this.$textarea.is( ':focus' );

		/*
		 * Default configuration, which we may conditionally add to later.
		 * @see https://codemirror.net/docs/ref/#state.Extension
		 */
		const extensions = [
			this.defaultExtensions,
			this.langExtension,
			EditorView.updateListener.of( ( update ) => {
				if ( update.docChanged && typeof this.realtimePreviewHandler === 'function' ) {
					this.realtimePreviewHandler();
				}
			} )
		];

		this.initialize( extensions );
		this.addRealtimePreviewHandler();

		// Sync scroll position, selections, and focus state.
		requestAnimationFrame( () => {
			this.view.scrollDOM.scrollTop = scrollTop;
		} );
		if ( selectionStart !== 0 || selectionEnd !== 0 ) {
			const range = EditorSelection.range( selectionStart, selectionEnd ),
				scrollEffect = EditorView.scrollIntoView( range );
			scrollEffect.value.isSnapshot = true;
			this.view.dispatch( {
				selection: EditorSelection.create( [ range ] ),
				effects: scrollEffect
			} );
		}
		if ( hasFocus ) {
			this.view.focus();
		}

		/**
		 * Called after CodeMirror is enabled or disabled in WikiEditor.
		 *
		 * @event CodeMirrorWikiEditor~'ext.CodeMirror.switch'
		 * @param {boolean} enabled Whether CodeMirror is enabled.
		 * @param {jQuery} $textarea The current "editor", either the
		 *   original textarea or the `.cm-editor` element.
		 * @stable to use
		 */
		mw.hook( 'ext.CodeMirror.switch' ).fire( true, $( this.view.dom ) );
	}

	/**
	 * Adds the Realtime Preview handler. Realtime Preview reads from the textarea
	 * via jQuery.textSelection, which will bubble up to CodeMirror automatically.
	 *
	 * @private
	 */
	addRealtimePreviewHandler() {
		mw.hook( 'ext.WikiEditor.realtimepreview.enable' ).add( ( realtimePreview ) => {
			this.realtimePreviewHandler = realtimePreview.getEventHandler().bind( realtimePreview );
		} );
		mw.hook( 'ext.WikiEditor.realtimepreview.disable' ).add( () => {
			this.realtimePreviewHandler = null;
		} );
	}

	/**
	 * Adds the CodeMirror button to WikiEditor.
	 *
	 * @stable to call
	 */
	addCodeMirrorToWikiEditor() {
		const context = this.$textarea.data( 'wikiEditor-context' );
		const toolbar = context && context.modules && context.modules.toolbar;

		// Guard against something having removed WikiEditor (T271457)
		if ( !toolbar ) {
			return;
		}

		this.$textarea.wikiEditor(
			'addToToolbar',
			{
				section: 'main',
				groups: {
					codemirror: {
						tools: {
							CodeMirror: {
								label: mw.msg( 'codemirror-toggle-label' ),
								type: 'toggle',
								oouiIcon: 'highlight',
								action: {
									type: 'callback',
									execute: () => this.switchCodeMirror()
								}
							}
						}
					}
				}
			}
		);

		const $codeMirrorButton = toolbar.$toolbar.find( '.tool[rel=CodeMirror]' );
		$codeMirrorButton.attr( 'id', 'mw-editbutton-codemirror' );

		// Hide non-applicable buttons until WikiEditor better supports a read-only mode (T188817).
		if ( this.readOnly ) {
			this.$textarea.data( 'wikiEditor-context' ).$ui.addClass( 'ext-codemirror-readonly' );
		}

		if ( this.useCodeMirror ) {
			this.enableCodeMirror();
		}
		this.updateToolbarButton();

		this.logUsage( {
			editor: 'wikitext',
			enabled: this.useCodeMirror,
			toggled: false,
			// eslint-disable-next-line no-jquery/no-global-selector,camelcase
			edit_start_ts_ms: parseInt( $( 'input[name="wpStarttime"]' ).val(), 10 ) * 1000 || 0
		} );
	}

	/**
	 * Updates CodeMirror button on the toolbar according to the current state (on/off).
	 *
	 * @private
	 */
	updateToolbarButton() {
		// eslint-disable-next-line no-jquery/no-global-selector
		const $button = $( '#mw-editbutton-codemirror' );
		$button.toggleClass( 'mw-editbutton-codemirror-active', this.useCodeMirror );

		// WikiEditor2010 OOUI ToggleButtonWidget
		if ( $button.data( 'setActive' ) ) {
			$button.data( 'setActive' )( this.useCodeMirror );
		}
	}

	/**
	 * Enables or disables CodeMirror.
	 *
	 * @fires CodeMirrorWikiEditor~'ext.CodeMirror.switch'
	 * @stable to call
	 */
	switchCodeMirror() {
		if ( this.view ) {
			this.setCodeMirrorPreference( false );
			this.destroy();
			mw.hook( 'ext.CodeMirror.switch' ).fire( false, this.$textarea );
		} else {
			this.enableCodeMirror();
			this.setCodeMirrorPreference( true );
		}
		this.updateToolbarButton();

		this.logUsage( {
			editor: 'wikitext',
			enabled: this.useCodeMirror,
			toggled: true,
			// eslint-disable-next-line no-jquery/no-global-selector,camelcase
			edit_start_ts_ms: parseInt( $( 'input[name="wpStarttime"]' ).val(), 10 ) * 1000 || 0
		} );
	}
}

export default CodeMirrorWikiEditor;
