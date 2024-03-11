import { EditorState, Extension } from '@codemirror/state';
import { EditorView, lineNumbers, highlightSpecialChars } from '@codemirror/view';
import CodemirrorTextSelection from './codemirror.textSelection';
import bidiIsolationExtension from './codemirror.bidiIsolation';

// Necessary so that `require` doesn't get mangled into `__webpack_require__`,
// which ResourceLoader won't recognize and thus be unable to load the virtual file.
// See https://webpack-v3.jsx.app/api/module-variables/#__non_webpack_require__-webpack-specific-
__non_webpack_require__( '../ext.CodeMirror.data.js' );

/**
 * @class CodeMirror
 * @property {jQuery} $textarea
 * @property {EditorView} view
 * @property {EditorState} state
 * @property {boolean} readOnly
 * @property {CodemirrorTextSelection} textSelection
 */
export default class CodeMirror {
	/**
	 * @constructor
	 * @param {HTMLTextAreaElement|jQuery|string} textarea Textarea to add syntax highlighting to.
	 */
	constructor( textarea ) {
		this.$textarea = $( textarea );
		this.view = null;
		this.state = null;
		this.readOnly = this.$textarea.prop( 'readonly' );
		this.textSelection = null;
	}

	/**
	 * Extensions here should be applicable to all theoretical uses of CodeMirror in MediaWiki.
	 * Don't assume CodeMirror is used for editing (i.e. "View source" of a protected page).
	 * Subclasses are safe to override this method if needed.
	 *
	 * @see https://codemirror.net/docs/ref/#state.Extension
	 * @return {Extension[]}
	 */
	get defaultExtensions() {
		const extensions = [
			this.contentAttributesExtension,
			this.phrasesExtension,
			this.specialCharsExtension,
			this.heightExtension,
			EditorState.readOnly.of( this.readOnly )
		];

		// Add bidi isolation to tags on RTL pages (T358804).
		if ( this.$textarea.attr( 'dir' ) === 'rtl' ) {
			extensions.push( bidiIsolationExtension );
		}

		// Set to [] to disable everywhere, or null to enable everywhere
		const namespaces = mw.config.get( 'extCodeMirrorConfig' ).lineNumberingNamespaces;
		if ( !namespaces || namespaces.includes( mw.config.get( 'wgNamespaceNumber' ) ) ) {
			extensions.push( lineNumbers() );
		}

		return extensions;
	}

	/**
	 * This extension sets the height of the CodeMirror editor to match the textarea.
	 * Override this method to change the height of the editor.
	 *
	 * @return {Extension}
	 * @stable
	 */
	get heightExtension() {
		return EditorView.theme( {
			'&': {
				height: `${ this.$textarea.outerHeight() }px`
			},
			'.cm-scroller': {
				overflow: 'auto'
			}
		} );
	}

	/**
	 * This specifies which attributes get added to the .cm-content and .cm-editor elements.
	 * Subclasses are safe to override this method, but attributes here are considered vital.
	 *
	 * @see https://codemirror.net/docs/ref/#view.EditorView^contentAttributes
	 * @return {Extension}
	 */
	get contentAttributesExtension() {
		const classList = [];
		// T245568: Sync text editor font preferences with CodeMirror
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

		return [
			// .cm-content element (the contenteditable area)
			EditorView.contentAttributes.of( {
				// T259347: Use accesskey of the original textbox
				accesskey: this.$textarea.attr( 'accesskey' ),
				// Classes need to be on .cm-content to have precedence over .cm-scroller
				class: classList.join( ' ' )
			} ),
			// .cm-editor element (contains the whole CodeMirror UI)
			EditorView.editorAttributes.of( {
				// Use direction and language of the original textbox.
				// These should be attributes of .cm-editor, not the .cm-content (T359589)
				dir: this.$textarea.attr( 'dir' ),
				lang: this.$textarea.attr( 'lang' )
			} )
		];
	}

	/**
	 * These are all potential messages used in a full-featured CodeMirror setup.
	 * We lump them all here and supply it as default extensions because it is only a small cost
	 * and we don't want localization to be overlooked by CodeMirror clients and subclasses.
	 *
	 * @see https://codemirror.net/examples/translate/
	 * @return {Extension}
	 */
	get phrasesExtension() {
		return EditorState.phrases.of( {
			Find: mw.msg( 'codemirror-find' ),
			next: mw.msg( 'codemirror-next' ),
			previous: mw.msg( 'codemirror-previous' ),
			all: mw.msg( 'codemirror-all' ),
			'match case': mw.msg( 'codemirror-match-case' ),
			regexp: mw.msg( 'codemirror-regexp' ),
			'by word': mw.msg( 'codemirror-by-word' ),
			replace: mw.msg( 'codemirror-replace' ),
			Replace: mw.msg( 'codemirror-replace-placeholder' ),
			'replace all': mw.msg( 'codemirror-replace-all' ),
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
	 * @return {Extension}
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
			addSpecialChars: /\u00a0|\u202f/g
		} );
	}

	/**
	 * Setup CodeMirror and add it to the DOM. This will hide the original textarea.
	 *
	 * @param {Extension[]} extensions
	 * @stable
	 */
	initialize( extensions = this.defaultExtensions ) {
		mw.hook( 'ext.CodeMirror.initialize' ).fire( this.$textarea );

		// Set up the initial EditorState of CodeMirror with contents of the native textarea.
		this.state = EditorState.create( {
			doc: this.$textarea.textSelection( 'getContents' ),
			extensions
		} );

		// Add CodeMirror view to the DOM.
		this.view = new EditorView( {
			state: this.state,
			parent: this.$textarea.parent()[ 0 ]
		} );

		// Hide native textarea and sync CodeMirror contents upon submission.
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

		// Register $.textSelection() on the .cm-editor element.
		$( this.view.dom ).textSelection( 'register', this.cmTextSelection );
		// Also override textSelection() functions for the "real" hidden textarea to route to
		// CodeMirror. We unregister this when switching to normal textarea mode.
		this.$textarea.textSelection( 'register', this.cmTextSelection );
	}

	/**
	 * Log usage of CodeMirror.
	 *
	 * @param {Object} data
	 * @stable
	 */
	logUsage( data ) {
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
	 * @stable
	 */
	setCodeMirrorPreference( prefValue ) {
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
	 * @see https://doc.wikimedia.org/mediawiki-core/master/js/#!/api/jQuery.plugin.textSelection
	 * @return {Object}
	 */
	get cmTextSelection() {
		if ( !this.textSelection ) {
			this.textSelection = new CodemirrorTextSelection( this.view );
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
