import { EditorState, Extension } from '@codemirror/state';
import { EditorView, lineNumbers, highlightSpecialChars } from '@codemirror/view';

/**
 * @class CodeMirror
 * @property {jQuery} $textarea
 * @property {EditorView} view
 * @property {EditorState} state
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
			this.specialCharsExtension
		];
		const namespaces = mw.config.get( 'wgCodeMirrorLineNumberingNamespaces' );

		// Set to [] to disable everywhere, or null to enable everywhere
		if ( !namespaces || namespaces.includes( mw.config.get( 'wgNamespaceNumber' ) ) ) {
			extensions.push( lineNumbers() );
		}
		return extensions;
	}

	/**
	 * This specifies which attributes get added to the .cm-content element.
	 * If you need to add more, add another Extension on initialization for the contentAttributes
	 * Facet in the form of EditorView.contentAttributes.of( {Object} ).
	 * Subclasses are safe to override this method, but attributes here are considered vital.
	 *
	 * @see https://codemirror.net/docs/ref/#view.EditorView^contentAttributes
	 * @return {Extension}
	 */
	get contentAttributesExtension() {
		return EditorView.contentAttributes.of( {
			// T259347: Use accesskey of the original textbox
			accesskey: this.$textarea.attr( 'accesskey' ),
			// use direction and language of the original textbox
			dir: this.$textarea.attr( 'dir' ),
			lang: this.$textarea.attr( 'lang' )
		} );
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

		// Add colorblind mode if preference is set.
		// This currently is only to be used for the MediaWiki markup language.
		if (
			mw.user.options.get( 'usecodemirror-colorblind' ) &&
			mw.config.get( 'wgPageContentModel' ) === 'wikitext'
		) {
			this.view.dom.classList.add( 'cm-mw-colorblind-colors' );
		}

		// Hide native textarea and sync CodeMirror contents upon submission.
		this.$textarea.hide();
		if ( this.$textarea[ 0 ].form ) {
			this.$textarea[ 0 ].form.addEventListener( 'submit', () => {
				this.$textarea.val( this.view.state.doc.toString() );
			} );
		}

		// Register $.textSelection() on the .cm-editor element.
		$( this.view.dom ).textSelection( 'register', this.cmTextSelection );
		// Also override textSelection() functions for the "real" hidden textarea to route to
		// CodeMirror. We unregister this when switching to normal textarea mode.
		this.$textarea.textSelection( 'register', this.cmTextSelection );

		mw.hook( 'ext.CodeMirror.switch' ).fire( true, $( this.view.dom ) );
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
		const $cmDom = $( this.view.dom );
		return {
			getContents: () => this.view.state.doc.toString(),
			setContents: ( content ) => {
				this.view.dispatch( {
					changes: {
						from: 0,
						to: this.view.state.doc.length,
						insert: content
					}
				} );
				return $cmDom;
			},
			getSelection: () => {
				return this.view.state.sliceDoc(
					this.view.state.selection.main.from,
					this.view.state.selection.main.to
				);
			},
			setSelection: ( options = { start: 0, end: 0 } ) => {
				this.view.dispatch( {
					selection: { anchor: options.start, head: ( options.end || options.start ) }
				} );
				this.view.focus();
				return $cmDom;
			},
			replaceSelection: ( value ) => {
				this.view.dispatch(
					this.view.state.replaceSelection( value )
				);
				return $cmDom;
			},
			getCaretPosition: ( options ) => {
				if ( !options.startAndEnd ) {
					return this.view.state.selection.main.head;
				}
				return [
					this.view.state.selection.main.from,
					this.view.state.selection.main.to
				];
			},
			scrollToCaretPosition: () => {
				this.view.dispatch( {
					effects: EditorView.scrollIntoView( this.view.state.selection.main.head )
				} );
				return $cmDom;
			}
		};
	}
}
