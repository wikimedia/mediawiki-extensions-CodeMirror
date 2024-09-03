const {
	EditorState,
	EditorView,
	Extension,
	Compartment,
	KeyBinding,
	ViewUpdate,
	bracketMatching,
	crosshairCursor,
	defaultKeymap,
	drawSelection,
	highlightSpecialChars,
	history,
	historyKeymap,
	keymap,
	lineNumbers,
	rectangularSelection,
	redo
} = require( 'ext.CodeMirror.v6.lib' );
const CodeMirrorTextSelection = require( './codemirror.textSelection.js' );
const CodeMirrorSearch = require( './codemirror.search.js' );
const CodeMirrorGotoLine = require( './codemirror.gotoLine.js' );
require( './ext.CodeMirror.data.js' );

/**
 * Interface for the CodeMirror editor.
 *
 * @example
 * mw.loader.using( [
 *   'ext.CodeMirror.v6',
 *   'ext.CodeMirror.v6.mode.mediawiki'
 * ] ).then( ( require ) => {
 *   const CodeMirror = require( 'ext.CodeMirror.v6' );
 *   const mediawikiLang = require( 'ext.CodeMirror.v6.mode.mediawiki' );
 *   const cm = new CodeMirror( myTextarea );
 *   cm.initialize( [ cm.defaultExtensions, mediawikiLang() ] );
 * } );
 */
class CodeMirror {
	/**
	 * Instantiate a new CodeMirror instance.
	 *
	 * @param {HTMLTextAreaElement|jQuery|string|ve.ui.Surface} textarea Textarea to
	 *   add syntax highlighting to.
	 * @constructor
	 */
	constructor( textarea ) {
		if ( textarea.constructor.name === 'VeUiMWWikitextSurface' ) {
			/**
			 * The VisualEditor surface CodeMirror is bound to.
			 *
			 * @type {ve.ui.Surface}
			 */
			this.surface = textarea;

			// Let the content editable mimic the textarea.
			// eslint-disable-next-line no-jquery/variable-pattern
			textarea = this.surface.getView().$attachedRootNode;
		}
		/**
		 * The textarea that CodeMirror is bound to.
		 *
		 * @type {jQuery}
		 */
		this.$textarea = $( textarea );
		/**
		 * The editor user interface.
		 *
		 * @type {EditorView}
		 */
		this.view = null;
		/**
		 * The editor state.
		 *
		 * @type {EditorState}
		 */
		this.state = null;
		/**
		 * Whether the textarea is read-only.
		 *
		 * @type {boolean}
		 */
		this.readOnly = this.surface ?
			this.surface.getModel().isReadOnly() :
			this.$textarea.prop( 'readonly' );
		/**
		 * The [edit recovery]{@link https://www.mediawiki.org/wiki/Manual:Edit_Recovery} handler.
		 *
		 * @type {Function|null}
		 */
		this.editRecoveryHandler = null;
		/**
		 * jQuery.textSelection overrides for CodeMirror.
		 *
		 * @type {CodeMirrorTextSelection}
		 */
		this.textSelection = null;
		/**
		 * Compartment for the language direction Extension.
		 *
		 * @type {Compartment}
		 */
		this.dirCompartment = new Compartment();
		/**
		 * Compartment for the special characters Extension.
		 *
		 * @type {Compartment}
		 */
		this.specialCharsCompartment = new Compartment();
	}

	/**
	 * Default extensions used by CodeMirror.
	 * Extensions here should be applicable to all theoretical uses of CodeMirror in MediaWiki.
	 *
	 * @see https://codemirror.net/docs/ref/#state.Extension
	 * @type {Extension|Extension[]}
	 * @stable to call
	 */
	get defaultExtensions() {
		const extensions = [
			this.contentAttributesExtension,
			this.phrasesExtension,
			this.specialCharsCompartment.of( this.specialCharsExtension ),
			this.heightExtension,
			this.updateExtension,
			this.bracketMatchingExtension,
			this.dirExtension,
			this.searchExtension,
			EditorState.readOnly.of( this.readOnly ),
			EditorView.domEventHandlers( {
				blur: () => {
					this.$textarea[ 0 ].dispatchEvent( new Event( 'blur' ) );
				},
				focus: () => {
					this.$textarea[ 0 ].dispatchEvent( new Event( 'focus' ) );
				}
			} ),
			EditorView.lineWrapping,
			keymap.of( defaultKeymap ),
			EditorState.allowMultipleSelections.of( true ),
			drawSelection(),
			rectangularSelection(),
			crosshairCursor()
		];

		// Add extensions relevant to editing (not read-only).
		if ( !this.readOnly ) {
			extensions.push( EditorView.updateListener.of( ( update ) => {
				if ( update.docChanged && typeof this.editRecoveryHandler === 'function' ) {
					this.editRecoveryHandler();
				}
			} ) );
			extensions.push( history() );
			extensions.push( keymap.of(
				historyKeymap.concat( /** @type {KeyBinding} */ {
					win: 'Ctrl-Shift-z',
					run: redo,
					preventDefault: true
				} )
			) );
		}

		// Set to [] to disable everywhere, or null to enable everywhere
		const namespaces = mw.config.get( 'extCodeMirrorConfig' ).lineNumberingNamespaces;
		if ( !namespaces || namespaces.includes( mw.config.get( 'wgNamespaceNumber' ) ) ) {
			extensions.push( lineNumbers() );
		}

		return extensions;
	}

	/**
	 * Extension for search and goto line functionality.
	 *
	 * @return {Extension|Extension[]}
	 */
	get searchExtension() {
		return [
			new CodeMirrorSearch().extension,
			new CodeMirrorGotoLine().extension
		];
	}

	/**
	 * This extension adds bracket matching to the CodeMirror editor.
	 *
	 * @return {Extension}
	 */
	get bracketMatchingExtension() {
		return bracketMatching( mw.config.get( 'wgPageContentModel' ) === 'wikitext' ?
			{
				// Also match CJK full-width brackets (T362992)
				// This is only for wikitext as it can be confusing in programming languages.
				brackets: '()[]{}（）【】［］｛｝'
			} : {}
		);
	}

	/**
	 * This extension listens for changes in the CodeMirror editor and fires
	 * the `ext.CodeMirror.input` hook with the {@link ViewUpdate} object.
	 *
	 * @type {Extension}
	 * @fires CodeMirror~'ext.CodeMirror.input'
	 * @stable to call and override
	 */
	get updateExtension() {
		return EditorView.updateListener.of( ( update ) => {
			if ( update.docChanged ) {
				/**
				 * Called when document changes are made in CodeMirror.
				 * The native textarea is not necessarily updated yet.
				 *
				 * @event CodeMirror~'ext.CodeMirror.input'
				 * @param {ViewUpdate} update
				 * @stable to use
				 */
				mw.hook( 'ext.CodeMirror.input' ).fire( update );
			}
		} );
	}

	/**
	 * This extension sets the height of the CodeMirror editor to match the textarea.
	 * Override this method to change the height of the editor.
	 *
	 * @type {Extension}
	 * @stable to call and override
	 */
	get heightExtension() {
		return EditorView.theme( {
			'&': {
				height: this.surface ? '100%' : `${ this.$textarea.outerHeight() }px`
			},
			'.cm-scroller': {
				overflow: 'auto'
			}
		} );
	}

	/**
	 * This specifies which attributes get added to the `.cm-content` and `.cm-editor` elements.
	 * Subclasses are safe to override this method, but attributes here are considered vital.
	 *
	 * @see https://codemirror.net/docs/ref/#view.EditorView^contentAttributes
	 * @type {Extension}
	 * @stable to call and override
	 */
	get contentAttributesExtension() {
		const classList = [];
		// T245568: Sync text editor font preferences with CodeMirror,
		// but don't do this for the 2017 wikitext editor.
		if ( !this.surface ) {
			const fontClass = Array.from( this.$textarea[ 0 ].classList )
				.find( ( style ) => style.startsWith( 'mw-editfont-' ) );
			if ( fontClass ) {
				classList.push( fontClass );
			}
			// Add colorblind mode if preference is set.
			// This currently is only to be used for the MediaWiki markup language.
			if (
				mw.user.options.get( 'usecodemirror-colorblind' ) &&
				mw.config.get( 'wgPageContentModel' ) === 'wikitext'
			) {
				classList.push( 'cm-mw-colorblind-colors' );
			}
		}

		return [
			// .cm-content element (the contenteditable area)
			EditorView.contentAttributes.of( {
				// T259347: Use accesskey of the original textbox
				accesskey: this.$textarea.attr( 'accesskey' ),
				// Classes need to be on .cm-content to have precedence over .cm-scroller
				class: classList.join( ' ' ),
				spellcheck: 'true',
				tabindex: this.$textarea.attr( 'tabindex' )
			} ),
			// .cm-editor element (contains the whole CodeMirror UI)
			EditorView.editorAttributes.of( {
				// Use language of the original textbox.
				// These should be attributes of .cm-editor, not the .cm-content (T359589)
				lang: this.$textarea.attr( 'lang' )
			} ),
			// The search panel should use the same direction as the interface language (T359611)
			EditorView.theme( {
				'.cm-panels': {
					direction: document.dir
				}
			} )
		];
	}

	/**
	 * These are all potential messages used in a full-featured CodeMirror setup.
	 * We lump them all here and supply it as default extensions because it is only a small cost
	 * and we don't want localization to be overlooked by CodeMirror clients and subclasses.
	 *
	 * @see https://codemirror.net/examples/translate/
	 * @type {Extension}
	 * @stable to call. Instead of overriding, pass in an additional `EditorState.phrases.of()`
	 *   when calling `initialize()`.
	 */
	get phrasesExtension() {
		return EditorState.phrases.of( {
			'Control character': mw.msg( 'codemirror-control-character' )
		} );
	}

	/**
	 * We give a small subset of special characters a tooltip explaining what they are.
	 * The messages and for what characters are defined here.
	 * Any character that does not have a message will instead use CM6 defaults,
	 * which is the localization of 'codemirror-control-character' followed by the Unicode number.
	 *
	 * @see https://codemirror.net/docs/ref/#view.highlightSpecialChars
	 * @type {Extension}
	 * @stable to call
	 */
	get specialCharsExtension() {
		// Keys are the decimal unicode number, values are the messages.
		const messages = {
			0: mw.msg( 'codemirror-special-char-null' ),
			7: mw.msg( 'codemirror-special-char-bell' ),
			8: mw.msg( 'codemirror-special-char-backspace' ),
			10: mw.msg( 'codemirror-special-char-newline' ),
			11: mw.msg( 'codemirror-special-char-vertical-tab' ),
			13: mw.msg( 'codemirror-special-char-carriage-return' ),
			27: mw.msg( 'codemirror-special-char-escape' ),
			160: mw.msg( 'codemirror-special-char-nbsp' ),
			8203: mw.msg( 'codemirror-special-char-zero-width-space' ),
			8204: mw.msg( 'codemirror-special-char-zero-width-non-joiner' ),
			8205: mw.msg( 'codemirror-special-char-zero-width-joiner' ),
			8206: mw.msg( 'codemirror-special-char-left-to-right-mark' ),
			8207: mw.msg( 'codemirror-special-char-right-to-left-mark' ),
			8232: mw.msg( 'codemirror-special-char-line-separator' ),
			8237: mw.msg( 'codemirror-special-char-left-to-right-override' ),
			8238: mw.msg( 'codemirror-special-char-right-to-left-override' ),
			8239: mw.msg( 'codemirror-special-char-narrow-nbsp' ),
			8294: mw.msg( 'codemirror-special-char-left-to-right-isolate' ),
			8295: mw.msg( 'codemirror-special-char-right-to-left-isolate' ),
			8297: mw.msg( 'codemirror-special-char-pop-directional-isolate' ),
			8233: mw.msg( 'codemirror-special-char-paragraph-separator' ),
			65279: mw.msg( 'codemirror-special-char-zero-width-no-break-space' ),
			65532: mw.msg( 'codemirror-special-char-object-replacement' )
		};

		return highlightSpecialChars( {
			render: ( code, description, placeholder ) => {
				description = messages[ code ] || mw.msg( 'codemirror-control-character', code );
				const span = document.createElement( 'span' );
				span.className = 'cm-specialChar';

				// Special case non-breaking spaces (T181677).
				if ( code === 160 || code === 8239 ) {
					placeholder = '·';
					span.className = 'cm-special-char-nbsp';
				}

				span.textContent = placeholder;
				span.title = description;
				span.setAttribute( 'aria-label', description );
				return span;
			},
			// Highlight non-breaking spaces (T181677)
			addSpecialChars: /[\u00a0\u202f]/g
		} );
	}

	get dirExtension() {
		return [
			this.dirCompartment.of( EditorView.editorAttributes.of( {
				// Use direction of the original textbox.
				// These should be attributes of .cm-editor, not the .cm-content (T359589)
				dir: this.$textarea.attr( 'dir' )
			} ) ),
			keymap.of( [ {
				key: 'Mod-Shift-x',
				run: ( view ) => {
					const dir = this.$textarea.attr( 'dir' ) === 'rtl' ? 'ltr' : 'rtl';
					this.$textarea.attr( 'dir', dir );
					view.dispatch( {
						effects: this.dirCompartment.reconfigure(
							EditorView.editorAttributes.of( { dir } )
						)
					} );
					return true;
				}
			} ] )
		];
	}

	/**
	 * Setup CodeMirror and add it to the DOM. This will hide the original textarea.
	 *
	 * @param {Extension|Extension[]} [extensions=this.defaultExtensions] Extensions to use.
	 * @fires CodeMirror~'ext.CodeMirror.initialize'
	 * @fires CodeMirror~'ext.CodeMirror.ready'
	 * @stable to call and override
	 */
	initialize( extensions = this.defaultExtensions ) {
		/**
		 * Called just before CodeMirror is initialized.
		 * This can be used to manipulate the DOM to suit CodeMirror
		 * (i.e. if you manipulate WikiEditor's DOM, you may need this).
		 *
		 * @event CodeMirror~'ext.CodeMirror.initialize'
		 * @param {jQuery} $textarea The textarea that CodeMirror is bound to.
		 * @stable to use
		 */
		mw.hook( 'ext.CodeMirror.initialize' ).fire( this.$textarea );
		mw.hook( 'editRecovery.loadEnd' ).add( ( data ) => {
			this.editRecoveryHandler = data.fieldChangeHandler;
		} );

		// Set up the initial EditorState of CodeMirror with contents of the native textarea.
		this.state = EditorState.create( {
			doc: this.surface ?
				this.surface.getDom() :
				this.$textarea.textSelection( 'getContents' ),
			extensions
		} );

		// Add CodeMirror view to the DOM.
		this.addCodeMirrorToDom();

		// Hide native textarea and sync CodeMirror contents upon submission.
		if ( !this.surface ) {
			this.$textarea.hide();
			if ( this.$textarea[ 0 ].form ) {
				this.$textarea[ 0 ].form.addEventListener( 'submit', () => {
					this.$textarea.val( this.view.state.doc.toString() );
					const scrollTop = document.getElementById( 'wpScrolltop' );
					if ( scrollTop ) {
						scrollTop.value = this.view.scrollDOM.scrollTop;
					}
				} );
			}
		}

		// Register $.textSelection() on the .cm-editor element.
		$( this.view.dom ).textSelection( 'register', this.cmTextSelection );
		// Also override textSelection() functions for the "real" hidden textarea to route to
		// CodeMirror. We unregister this when switching to normal textarea mode.
		this.$textarea.textSelection( 'register', this.cmTextSelection );

		/**
		 * Called just after CodeMirror is initialized.
		 *
		 * @event CodeMirror~'ext.CodeMirror.ready'
		 * @param {jQuery} $view The CodeMirror view.
		 * @stable to use
		 */
		mw.hook( 'ext.CodeMirror.ready' ).fire( $( this.view.dom ) );
	}

	/**
	 * Instantiate the EditorView, adding the CodeMirror editor to the DOM.
	 * We use a dummy container to ensure that the editor will
	 * always be placed where the textarea is.
	 *
	 * @private
	 */
	addCodeMirrorToDom() {
		this.$textarea.wrap( '<div class="ext-codemirror-wrapper"></div>' );

		this.view = new EditorView( {
			state: this.state,
			parent: this.surface ?
				this.surface.getView().$element[ 0 ] :
				this.$textarea.parent()[ 0 ]
		} );
	}

	/**
	 * Destroy the CodeMirror instance and revert to the original textarea.
	 *
	 * @fires CodeMirror~'ext.CodeMirror.destroy'
	 * @stable to call and override
	 */
	destroy() {
		const scrollTop = this.view.scrollDOM.scrollTop;
		const hasFocus = this.view.hasFocus;
		const { from, to } = this.view.state.selection.ranges[ 0 ];
		$( this.view.dom ).textSelection( 'unregister' );
		this.$textarea.textSelection( 'unregister' );
		this.$textarea.unwrap( '.ext-codemirror-wrapper' );
		if ( !this.surface ) {
			this.$textarea.val( this.view.state.doc.toString() );
		}
		this.view.destroy();
		this.view = null;
		this.$textarea.show();
		if ( hasFocus ) {
			this.$textarea.trigger( 'focus' );
		}
		this.$textarea.prop( 'selectionStart', Math.min( from, to ) )
			.prop( 'selectionEnd', Math.max( to, from ) );
		this.$textarea.scrollTop( scrollTop );
		this.textSelection = null;

		/**
		 * Called just after CodeMirror is destroyed and the original textarea is restored.
		 *
		 * @event CodeMirror~'ext.CodeMirror.destroy'
		 * @param {jQuery} $textarea The original textarea.
		 * @stable to use
		 */
		mw.hook( 'ext.CodeMirror.destroy' ).fire( this.$textarea );
	}

	/**
	 * Log usage of CodeMirror.
	 *
	 * @param {Object} data
	 * @stable to call
	 * @internal
	 * @ignore
	 */
	static logUsage( data ) {
		/* eslint-disable camelcase */
		const event = Object.assign( {
			session_token: mw.user.sessionId(),
			user_id: mw.user.getId()
		}, data );
		const editCountBucket = mw.config.get( 'wgUserEditCountBucket' );
		if ( editCountBucket !== null ) {
			event.user_edit_count_bucket = editCountBucket;
		}
		/* eslint-enable camelcase */
		mw.track( 'event.CodeMirrorUsage', event );
	}

	/**
	 * Save CodeMirror enabled preference.
	 *
	 * @param {boolean} prefValue True, if CodeMirror should be enabled by default, otherwise false.
	 * @stable to call and override
	 */
	static setCodeMirrorPreference( prefValue ) {
		// Skip for unnamed users
		if ( !mw.user.isNamed() ) {
			return;
		}
		new mw.Api().saveOption( 'usecodemirror', prefValue ? 1 : 0 );
		mw.user.options.set( 'usecodemirror', prefValue ? 1 : 0 );
	}

	/**
	 * jQuery.textSelection overrides for CodeMirror.
	 *
	 * @see jQuery.fn.textSelection
	 * @type {Object}
	 * @private
	 */
	get cmTextSelection() {
		if ( !this.textSelection ) {
			this.textSelection = new CodeMirrorTextSelection( this.view );
		}
		return {
			getContents: () => this.textSelection.getContents(),
			setContents: ( content ) => this.textSelection.setContents( content ),
			getCaretPosition: ( options ) => this.textSelection.getCaretPosition( options ),
			scrollToCaretPosition: () => this.textSelection.scrollToCaretPosition(),
			getSelection: () => this.textSelection.getSelection(),
			setSelection: ( options ) => this.textSelection.setSelection( options ),
			replaceSelection: ( value ) => this.textSelection.replaceSelection( value ),
			encapsulateSelection: ( options ) => this.textSelection.encapsulateSelection( options )
		};
	}
}

module.exports = CodeMirror;
