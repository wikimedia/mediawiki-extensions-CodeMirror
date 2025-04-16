const {
	Compartment,
	EditorSelection,
	EditorState,
	EditorView,
	Extension,
	StateEffect,
	ViewUpdate,
	bracketMatching,
	crosshairCursor,
	drawSelection,
	dropCursor,
	highlightActiveLine,
	highlightSpecialChars,
	highlightWhitespace,
	history,
	indentUnit,
	keymap,
	lineNumbers,
	rectangularSelection
} = require( 'ext.CodeMirror.v6.lib' );
const CodeMirrorTextSelection = require( './codemirror.textSelection.js' );
const CodeMirrorSearch = require( './codemirror.search.js' );
const CodeMirrorGotoLine = require( './codemirror.gotoLine.js' );
const CodeMirrorPreferences = require( './codemirror.preferences.js' );
const CodeMirrorKeymap = require( './codemirror.keymap.js' );
const CodeMirrorExtensionRegistry = require( './codemirror.extensionRegistry.js' );
require( './ext.CodeMirror.data.js' );

/**
 * Interface for the CodeMirror editor.
 *
 * This class is a wrapper around the {@link https://codemirror.net/ CodeMirror library},
 * providing a simplified interface for creating and managing CodeMirror instances in MediaWiki.
 *
 * ## Lifecycle
 *
 * * {@link CodeMirror#initialize initialize}
 * * {@link CodeMirror#activate activate}
 * * {@link CodeMirror#toggle toggle}
 * * {@link CodeMirror#deactivate deactivate}
 * * {@link CodeMirror#destroy destroy}
 *
 * @example
 * // Creating a new CodeMirror instance.
 * mw.loader.using( [
 *   'ext.CodeMirror.v6',
 *   'ext.CodeMirror.v6.mode.mediawiki'
 * ] ).then( ( require ) => {
 *   const CodeMirror = require( 'ext.CodeMirror.v6' );
 *   const mediawikiLang = require( 'ext.CodeMirror.v6.mode.mediawiki' );
 *   const cm = new CodeMirror( myTextarea, mediawikiLang() );
 *   cm.initialize();
 * } );
 *
 * // Integrating with an existing CodeMirror instance.
 * mw.hook( 'ext.CodeMirror.ready', ( cm ) => {
 *   cm.applyExtension( myExtension );
 * } );
 */
class CodeMirror {
	/**
	 * Instantiate a new CodeMirror instance.
	 *
	 * @param {HTMLTextAreaElement|jQuery|string} textarea Textarea to add syntax highlighting to.
	 * @param {LanguageSupport|Extension} [langExtension] Language support and its extension(s).
	 * @constructor
	 * @stable to call and extend
	 */
	constructor( textarea, langExtension = [] ) {
		if ( mw.config.get( 'cmDebug' ) ) {
			window.cm = this;
		}
		/**
		 * The textarea that CodeMirror is bound to.
		 *
		 * @type {HTMLTextAreaElement}
		 */
		this.textarea = $( textarea )[ 0 ];
		/**
		 * jQuery instance of the textarea for use with WikiEditor and jQuery plugins.
		 *
		 * @type {jQuery}
		 */
		this.$textarea = $( this.textarea );
		/**
		 * The VisualEditor surface CodeMirror is bound to.
		 *
		 * @type {ve.ui.Surface|null}
		 * @ignore
		 */
		this.surface = null;
		/**
		 * Language support and its extension(s).
		 *
		 * @type {LanguageSupport|Extension}
		 */
		this.langExtension = langExtension;
		/**
		 * The editor user interface.
		 *
		 * @type {EditorView}
		 */
		this.view = null;
		/**
		 * Whether the CodeMirror instance is active.
		 *
		 * @type {boolean}
		 */
		this.isActive = false;
		/**
		 * The .ext-codemirror-wrapper container. This houses both
		 * the original textarea and the CodeMirror editor.
		 *
		 * @type {HTMLDivElement}
		 */
		this.container = null;
		/**
		 * Whether the textarea is read-only.
		 *
		 * @type {boolean}
		 */
		this.readOnly = this.textarea.readOnly;
		/**
		 * The form `submit` event handler.
		 *
		 * @type {Function|null}
		 * @private
		 */
		this.formSubmitEventHandler = null;
		/**
		 * jQuery.textSelection overrides for CodeMirror.
		 *
		 * @type {CodeMirrorTextSelection}
		 */
		this.textSelection = null;
		/**
		 * Registry of CodeMirror {@link Extension Extensions}.
		 *
		 * @type {CodeMirrorExtensionRegistry}
		 */
		this.extensionRegistry = new CodeMirrorExtensionRegistry( {
			bracketMatching: this.bracketMatchingExtension,
			lineNumbering: this.lineNumberingExtension,
			lineWrapping: this.lineWrappingExtension,
			activeLine: this.activeLineExtension,
			specialChars: this.specialCharsExtension,
			whitespace: this.whitespaceExtension
		}, this.constructor.name === 'CodeMirrorVisualEditor' );
		/**
		 * Compartment to control the direction of the editor.
		 *
		 * @type {Compartment}
		 */
		this.dirCompartment = new Compartment();
		/**
		 * The CodeMirror preferences panel.
		 *
		 * @type {CodeMirrorPreferences}
		 */
		this.preferences = new CodeMirrorPreferences(
			this.extensionRegistry,
			this.constructor.name === 'CodeMirrorVisualEditor'
		);
		/**
		 * CodeMirror key mappings and help dialog.
		 *
		 * @type {CodeMirrorKeymap}
		 */
		this.keymap = new CodeMirrorKeymap();
		/**
		 * The go-to line panel.
		 *
		 * @type {CodeMirrorGotoLine}
		 */
		this.gotoLine = new CodeMirrorGotoLine();
		/**
		 * Mapping of mw.hook handlers added by CodeMirror.
		 * Handlers added here will be removed during deactivation.
		 *
		 * @type {Object<Set<Function>>}
		 * @private
		 */
		this.hooks = {};
	}

	/**
	 * Default extensions used by CodeMirror.
	 * Extensions here should be applicable to all theoretical uses of CodeMirror in MediaWiki.
	 * This getter can be overridden to apply additional extensions before
	 * {@link CodeMirror#initialize initialization}. To apply a new extension after initialization,
	 * use {@link CodeMirror#applyExtension applyExtension()}, or through
	 * {@link CodeMirrorExtensionRegistry} using
	 * {@link CodeMirrorExtensionRegistry#register register()} if it needs
	 * to be reconfigured (such as toggling on and off).
	 *
	 * @see https://codemirror.net/docs/ref/#state.Extension
	 * @type {Extension|Extension[]}
	 * @stable to call and override
	 */
	get defaultExtensions() {
		const extensions = [
			this.contentAttributesExtension,
			this.editorAttributesExtension,
			this.phrasesExtension,
			this.heightExtension,
			this.updateExtension,
			this.dirExtension,
			this.searchExtension,
			this.domEventHandlersExtension,
			this.preferences.extension,
			this.keymap.extension,
			indentUnit.of( '\t' ),
			EditorState.readOnly.of( this.readOnly ),
			EditorView.theme( {
				'.cm-scroller': {
					overflow: 'auto'
				},
				// Search panel should use the same direction as the interface language (T359611)
				'.cm-panels': {
					direction: document.dir
				}
			} ),
			EditorState.allowMultipleSelections.of( true ),
			drawSelection(),
			rectangularSelection(),
			crosshairCursor(),
			dropCursor(),
			this.langExtension
		];

		// Add extensions relevant to editing (not read-only).
		if ( !this.readOnly ) {
			extensions.push( EditorView.updateListener.of( ( update ) => {
				if ( update.docChanged && typeof this.editRecoveryHandler === 'function' ) {
					this.editRecoveryHandler();
				}
			} ) );
			extensions.push( history() );
		}

		return extensions;
	}

	/**
	 * Extension to bubble some DOM events to the original textarea.
	 *
	 * The CodeMirror events are natively fired on the {@link EditorView}'s
	 * `.cm-content` element, which is accessible through
	 * {@link CodeMirror#view `view.contentDOM`}. The `scroll` event is fired on
	 * the `.cm-scroller` element, which is accessible through
	 * {@link CodeMirror#view `view.scrollDOM`}.
	 *
	 * @type {Extension}
	 * @protected
	 */
	get domEventHandlersExtension() {
		return EditorView.domEventHandlers( {
			blur: () => {
				this.textarea.dispatchEvent( new FocusEvent( 'blur' ) );
			},
			focus: () => {
				this.textarea.dispatchEvent( new FocusEvent( 'focus' ) );
			},
			keyup: ( event ) => {
				this.textarea.dispatchEvent( new KeyboardEvent( 'keyup', event ) );
			},
			keydown: ( event ) => {
				this.textarea.dispatchEvent( new KeyboardEvent( 'keydown', event ) );
			},
			scroll: ( event ) => {
				if ( event.target === this.view.scrollDOM ) {
					this.textarea.dispatchEvent( new Event( 'scroll' ) );
				}
			}
		} );
	}

	/**
	 * Extension for highlighting the active line.
	 *
	 * @type {Extension}
	 */
	get activeLineExtension() {
		return highlightActiveLine();
	}

	/**
	 * Extension for line wrapping.
	 *
	 * @type {Extension}
	 */
	get lineWrappingExtension() {
		return EditorView.lineWrapping;
	}

	/**
	 * Extension for line numbering.
	 *
	 * @type {Extension}
	 */
	get lineNumberingExtension() {
		return [
			lineNumbers( {
				formatNumber: ( num ) => {
					const numberString = String( num );
					const transformTable = mw.language.getDigitTransformTable();
					if ( mw.config.get( 'wgTranslateNumerals' ) && transformTable ) {
						let convertedNumber = '';
						for ( let i = 0; i < numberString.length; i++ ) {
							// eslint-disable-next-line max-len
							if ( Object.prototype.hasOwnProperty.call( transformTable, numberString[ i ] ) ) {
								convertedNumber += transformTable[ numberString[ i ] ];
							} else {
								convertedNumber += numberString[ i ];
							}
						}
						return convertedNumber;
					}
					return numberString;
				}
			} ),
			EditorView.theme( {
				'.cm-lineNumbers .cm-gutterElement': {
					textAlign: 'end'
				}
			} )
		];
	}

	/**
	 * Extension for search and goto line functionality.
	 *
	 * @type {Extension}
	 */
	get searchExtension() {
		return [
			new CodeMirrorSearch().extension,
			this.gotoLine.extension
		];
	}

	/**
	 * This extension adds bracket matching to the CodeMirror editor.
	 *
	 * @type {Extension}
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
				 * The original textarea is not necessarily updated yet.
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
	 * This extension sets the height of the CodeMirror editor to match the
	 * {@link CodeMirror#textarea textarea}. This getter can be overridden to
	 * change the height of the editor, but it's usually simpler to set the
	 * height of the textarea using CSS prior to initialization.
	 *
	 * @type {Extension}
	 * @stable to call and override
	 */
	get heightExtension() {
		return EditorView.theme( {
			'&': {
				height: `${ this.$textarea.outerHeight() }px`
			}
		} );
	}

	/**
	 * This specifies which attributes get added to the CodeMirror contenteditable `.cm-content`.
	 * Subclasses are safe to override this method, but attributes here are considered vital.
	 *
	 * @see https://codemirror.net/docs/ref/#view.EditorView^contentAttributes
	 * @type {Extension}
	 * @protected
	 * @stable to call and override by subclasses
	 */
	get contentAttributesExtension() {
		const classList = [];

		// T245568: Sync text editor font preferences with CodeMirror.
		const fontClass = Array.from( this.textarea.classList )
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

		return EditorView.contentAttributes.of( {
			// T259347: Use accesskey of the original textbox
			accesskey: this.textarea.accessKey,
			// Classes need to be on .cm-content to have precedence over .cm-scroller
			class: classList.join( ' ' ),
			spellcheck: 'true',
			tabindex: this.textarea.tabIndex
		} );
	}

	/**
	 * This specifies which attributes get added to the `.cm-editor` element (the entire editor).
	 * Subclasses are safe to override this method, but attributes here are considered vital.
	 *
	 * @see https://codemirror.net/docs/ref/#view.EditorView^editorAttributes
	 * @type {Extension}
	 * @protected
	 * @stable to call and override by subclasses
	 */
	get editorAttributesExtension() {
		return EditorView.editorAttributes.of( {
			// Use language of the original textbox.
			// These should be attributes of .cm-editor, not the .cm-content (T359589)
			lang: this.textarea.lang
		} );
	}

	/**
	 * Overrides for the CodeMirror library's internalization system.
	 *
	 * @see https://codemirror.net/examples/translate/
	 * @type {Extension}
	 * @protected
	 * @stable to call and override by subclasses.
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
	 * @protected
	 * @stable to call
	 */
	get specialCharsExtension() {
		// Keys are the decimal Unicode number, values are the messages.
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

	/**
	 * This extension highlights whitespace characters.
	 *
	 * @return {Extension}
	 */
	get whitespaceExtension() {
		return highlightWhitespace();
	}

	/**
	 * This extension adds the ability to change the direction of the editor.
	 *
	 * @type {Extension}
	 * @protected
	 * @stable to call
	 */
	get dirExtension() {
		return [
			this.dirCompartment.of( EditorView.editorAttributes.of( {
				// Use direction of the original textbox.
				// These should be attributes of .cm-editor, not the .cm-content (T359589)
				dir: this.textarea.dir
			} ) ),
			// Register key binding for changing direction in CodeMirrorKeymap.
			keymap.of( [ {
				key: this.keymap.keymapHelpRegistry.other.direction.key,
				run: ( view ) => {
					const dir = this.textarea.dir === 'rtl' ? 'ltr' : 'rtl';
					this.textarea.dir = dir;
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
	 * This method should only be called once per instance. Use {@link CodeMirror#toggle toggle},
	 * {@link CodeMirror#activate activate}, and {@link CodeMirror#deactivate deactivate}
	 * to enable or disable the same CodeMirror instance programmatically, and restore or hide
	 * the original textarea.
	 *
	 * @param {Extension|Extension[]} [extensions={@link CodeMirror#defaultExtensions this.defaultExtensions}]
	 *   Extensions to use.
	 * @fires CodeMirror~'ext.CodeMirror.initialize'
	 * @fires CodeMirror~'ext.CodeMirror.ready'
	 * @stable to call and override
	 */
	initialize( extensions = this.defaultExtensions ) {
		if ( this.view ) {
			mw.log.warn( '[CodeMirror] CodeMirror instance already initialized.' );
			return;
		}

		/**
		 * Called just before CodeMirror is initialized.
		 * This can be used to manipulate the DOM to suit CodeMirror
		 * (i.e. if you manipulate WikiEditor's DOM, you may need this).
		 *
		 * @event CodeMirror~'ext.CodeMirror.initialize'
		 * @param {HTMLTextAreaElement|ve.ui.Surface} textarea The textarea or
		 *   VisualEditor surface that CodeMirror is bound to.
		 * @stable to use
		 */
		mw.hook( 'ext.CodeMirror.initialize' ).fire( this.surface || this.textarea );

		// Wrap the textarea with .ext-codemirror-wrapper
		this.container = document.createElement( 'div' );
		this.container.className = 'ext-codemirror-wrapper';
		this.textarea.before( this.container );
		this.container.appendChild( this.textarea );

		// Create the EditorState of CodeMirror with contents of the original textarea.
		const state = EditorState.create( {
			doc: this.surface ? this.surface.getDom() : this.textarea.value,
			extensions
		} );

		// Instantiate the view, adding it to the DOM
		this.view = new EditorView( { state, parent: this.container } );

		// Use toggle() instead of activate() directly so that the toggle hook is fired.
		this.toggle();

		this.addEditRecoveredHandler();
		this.addTextAreaJQueryHook();
		this.addFormSubmitHandler();

		/**
		 * Called just after CodeMirror is initialized.
		 *
		 * @event CodeMirror~'ext.CodeMirror.ready'
		 * @param {CodeMirror} cm The CodeMirror instance.
		 * @stable to use
		 */
		mw.hook( 'ext.CodeMirror.ready' ).fire( this );
	}

	/**
	 * Add a handler for the given {@link Hook}.
	 * This method is used to ensure no hook handlers are duplicated across lifecycle methods,
	 * All handlers will be removed during {@link CodeMirror#deactivate deactivation}.
	 *
	 * @param {string} hook
	 * @param {Function} fn
	 * @protected
	 */
	addMwHook( hook, fn ) {
		if ( !this.hooks[ hook ] ) {
			this.hooks[ hook ] = new Set();
		}
		if ( this.hooks[ hook ].has( fn ) ) {
			return;
		}
		this.hooks[ hook ].add( fn );
		mw.hook( hook ).add( fn );
	}

	/**
	 * Set a new edit recovery handler.
	 *
	 * @protected
	 */
	addEditRecoveredHandler() {
		mw.hook( 'editRecovery.loadEnd' ).add( ( data ) => {
			/**
			 * The [edit recovery]{@link https://www.mediawiki.org/wiki/Manual:Edit_Recovery} handler.
			 *
			 * @type {Function}
			 * @private
			 */
			this.editRecoveryHandler = data.fieldChangeHandler;
		} );
	}

	/**
	 * Define jQuery hook for .val() on the textarea.
	 *
	 * @see https://phabricator.wikimedia.org/T384556
	 * @protected
	 */
	addTextAreaJQueryHook() {
		const jQueryValHooks = $.valHooks.textarea;
		$.valHooks.textarea = {
			get: ( elem ) => {
				if ( elem === this.textarea && this.isActive ) {
					return this.cmTextSelection.getContents();
				} else if ( jQueryValHooks ) {
					return jQueryValHooks.get( elem );
				}
				return elem.value;
			},
			set: ( elem, value ) => {
				if ( elem === this.textarea && this.isActive ) {
					return this.cmTextSelection.setContents( value );
				} else if ( jQueryValHooks ) {
					return jQueryValHooks.set( elem, value );
				}
				elem.value = value;
			}
		};
	}

	/**
	 * Sync the CodeMirror editor with the original textarea on form submission.
	 *
	 * @protected
	 */
	addFormSubmitHandler() {
		if ( !this.textarea.form ) {
			return;
		}
		this.formSubmitEventHandler = () => {
			if ( !this.isActive ) {
				return;
			}
			this.textarea.value = this.view.state.doc.toString();
			const scrollTop = document.getElementById( 'wpScrolltop' );
			if ( scrollTop ) {
				scrollTop.value = this.view.scrollDOM.scrollTop;
			}
		};
		this.textarea.form.addEventListener( 'submit', this.formSubmitEventHandler );
	}

	/**
	 * Apply an {@link Extension} to the CodeMirror editor.
	 * This is accomplished through
	 * {@link https://codemirror.net/examples/config/#top-level-reconfiguration top-level reconfiguration}
	 * of the {@link CodeMirror#view EditorView}.
	 *
	 * If the extension needs to be reconfigured (such as toggling on and off), use the
	 * {@link CodeMirror#extensionRegistry extensionRegistry} instead.
	 *
	 * @example
	 * mw.loader.using( 'ext.CodeMirror.v6' ).then( ( require ) => {
	 *   mw.hook( 'ext.CodeMirror.ready' ).add( ( cm ) => {
	 *     const { EditorView, Prec } = require( 'ext.CodeMirror.v6.lib' );
	 *     // Disable spellchecking. Use Prec.high() to override the
	 *     // contentAttributesExtension which adds spellcheck="true".
	 *     cm.applyExtension( Prec.high( EditorView.contentAttributes.of( {
	 *       spellcheck: 'false'
	 *     } ) ) );
	 *   } );
	 * } );
	 * @see https://codemirror.net/examples/config/
	 * @param {Extension} extension
	 * @stable to call
	 */
	applyExtension( extension ) {
		this.view.dispatch( {
			effects: StateEffect.appendConfig.of( extension )
		} );
	}

	/**
	 * Toggle CodeMirror on or off from the textarea.
	 * This will call {@link CodeMirror#initialize initialize} if CodeMirror
	 * is being enabled for the first time.
	 *
	 * @param {boolean} [force] `true` to enable CodeMirror, `false` to disable.
	 *   Note that the {@link CodeMirror~'ext.CodeMirror.toggle' ext.CodeMirror.toggle}
	 *   hook will not be fired if this parameter is set.
	 * @stable to call and override
	 * @fires CodeMirror~'ext.CodeMirror.toggle'
	 */
	toggle( force ) {
		const toEnable = force === undefined ? !this.isActive : force;
		const wasActive = this.isActive;
		if ( toEnable ) {
			if ( !this.view ) {
				this.initialize();
			} else {
				this.activate();
			}
		} else {
			this.deactivate();
		}
		// Only fire the toggle hook when the active state has changed.
		if ( wasActive !== this.isActive ) {
			/**
			 * Called when CodeMirror is toggled on or off.
			 *
			 * @event CodeMirror~'ext.CodeMirror.toggle'
			 * @param {boolean} enabled `true` if CodeMirror is now enabled, `false` if disabled.
			 * @param {CodeMirror} cm The CodeMirror instance.
			 * @param {HTMLTextAreaElement} textarea The original textarea.
			 * @stable to use
			 */
			mw.hook( 'ext.CodeMirror.toggle' ).fire( this.isActive, this, this.textarea );
		}
	}

	/**
	 * Activate CodeMirror on the {@link CodeMirror#textarea textarea}.
	 * This sets the {@link CodeMirror#state state} property and shows the editor view,
	 * hiding the original textarea.
	 *
	 * {@link CodeMirror#initialize initialize} is expected to be called before this method.
	 *
	 * @protected
	 * @stable to call and override by subclasses
	 */
	activate() {
		if ( this.isActive ) {
			mw.log.warn( '[CodeMirror] CodeMirror instance already active.' );
			return;
		}

		this.setupFeatureLogging();

		// Backup scroll position, selections, and focus state before we hide the textarea.
		const selectionStart = this.textarea.selectionStart,
			selectionEnd = this.textarea.selectionEnd,
			scrollTop = this.textarea.scrollTop,
			hasFocus = document.activeElement === this.textarea;

		if ( this.view ) {
			// We're re-enabling, so we want to sync contents from the textarea.
			this.cmTextSelection.setContents(
				this.surface ? this.surface.getDom() : this.textarea.value
			);
		}

		// Re-show the view, should it be hidden.
		this.container.classList.remove( 'ext-codemirror-wrapper--hidden' );

		this.isActive = true;
		this.logEditFeature( 'activated' );

		// Register $.textSelection() on the .cm-editor element.
		$( this.view.dom ).textSelection( 'register', this.cmTextSelection );

		if ( !this.surface ) {
			// Override textSelection() functions for the "real" hidden textarea to route to
			// CodeMirror. We unregister this in this.deactivate().
			this.$textarea.textSelection( 'register', this.cmTextSelection );

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
		}
	}

	/**
	 * Deactivate CodeMirror on the {@link CodeMirror#textarea textarea}, restoring the original
	 * textarea and hiding the editor. This life-cycle method should retain the
	 * {@link CodeMirror#view view} but discard the {@link CodeMirror#state state}.
	 *
	 * @protected
	 * @stable to call and override by subclasses
	 */
	deactivate() {
		if ( !this.isActive ) {
			mw.log.warn( '[CodeMirror] CodeMirror instance is not active.' );
			return;
		}

		// Store what we need before we destroy the state or make DOM changes.
		const scrollTop = this.view.scrollDOM.scrollTop;
		const hasFocus = this.surface ? this.surface.getView().isFocused() : this.view.hasFocus;
		const { from, to } = this.view.state.selection.ranges[ 0 ];

		// Unregister textSelection() on the CodeMirror view.
		$( this.view.dom ).textSelection( 'unregister' );

		if ( !this.surface ) {
			// Sync contents to the original textarea.
			this.textarea.value = this.view.state.doc.toString();
			// Unregister textSelection() on the hidden textarea.
			this.$textarea.textSelection( 'unregister' );
		}

		// Remove hook handlers.
		Object.keys( this.hooks ).forEach( ( hook ) => {
			this.hooks[ hook ].forEach( ( fn ) => mw.hook( hook ).remove( fn ) );
			delete this.hooks[ hook ];
		} );

		// Hide the view. We use a CSS class on the wrapper since CodeMirror
		// adds high-specificity styles to .cm-editor that we can't easily override.
		this.container.classList.add( 'ext-codemirror-wrapper--hidden' );

		this.isActive = false;
		this.logEditFeature( 'deactivated' );

		if ( !this.surface ) {
			// Sync focus state, selections and scroll position.
			if ( hasFocus ) {
				this.textarea.focus();
			}
			this.textarea.selectionStart = Math.min( from, to );
			this.textarea.selectionEnd = Math.max( from, to );
			this.textarea.scrollTop = scrollTop;
		}
	}

	/**
	 * Destroy the CodeMirror instance and revert to the original textarea.
	 * This action should be considered irreversible.
	 *
	 * @fires CodeMirror~'ext.CodeMirror.destroy'
	 * @stable to call and override
	 */
	destroy() {
		this.deactivate();
		this.view.destroy();
		this.view = null;
		this.$textarea.unwrap( '.ext-codemirror-wrapper' );
		this.container = null;
		this.textSelection = null;
		// Remove form submission listener.
		if ( this.formSubmitEventHandler && this.textarea.form ) {
			this.textarea.form.removeEventListener( 'submit', this.formSubmitEventHandler );
			this.formSubmitEventHandler = null;
		}

		/**
		 * Called just after CodeMirror is destroyed and the original textarea is restored.
		 *
		 * @event CodeMirror~'ext.CodeMirror.destroy'
		 * @param {HTMLTextAreaElement} textarea The original textarea.
		 * @stable to use
		 */
		mw.hook( 'ext.CodeMirror.destroy' ).fire( this.textarea );
	}

	/**
	 * Log usage of CodeMirror.
	 *
	 * @param {string} action
	 * @see https://phabricator.wikimedia.org/T373710
	 * @protected
	 * @stable to call and override by subclasses
	 */
	// eslint-disable-next-line no-unused-vars
	logEditFeature( action ) {}

	/**
	 * Add hook handlers to log usage of CodeMirror features.
	 *
	 * @protected
	 * @stable to call and override by subclasses
	 */
	setupFeatureLogging() {
		this.addMwHook( 'ext.CodeMirror.preferences.apply', ( prefName, enabled ) => {
			// Log only when in-use and when the user has preferences differing from defaults.
			if ( enabled && this.preferences.hasNonDefaultPreferences() ) {
				this.logEditFeature( `prefs-${ prefName }` );
			}
		} );
		this.addMwHook( 'ext.CodeMirror.preferences.display',
			() => this.logEditFeature( 'prefs-display' )
		);
		this.addMwHook( 'ext.CodeMirror.search',
			() => this.logEditFeature( 'search' )
		);
		this.addMwHook( 'ext.CodeMirror.keymap',
			() => this.logEditFeature( 'keymap' )
		);
	}

	/**
	 * Save CodeMirror enabled preference.
	 *
	 * @param {boolean} prefValue `true` to enable CodeMirror where possible on page load.
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
