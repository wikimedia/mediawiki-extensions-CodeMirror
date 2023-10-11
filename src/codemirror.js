import { EditorState, Extension } from '@codemirror/state';
import { EditorView, lineNumbers } from '@codemirror/view';

/**
 * @class CodeMirror
 */
export default class CodeMirror {
	/**
	 * @constructor
	 * @param {jQuery} $textarea Textarea to add syntax highlighting to.
	 */
	constructor( $textarea ) {
		this.$textarea = $textarea;
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
			this.contentAttributesExtension
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
	 * Setup CodeMirror and add it to the DOM. This will hide the original textarea.
	 *
	 * @param {Extension[]} extensions
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
	 */
	setCodeMirrorPreference( prefValue ) {
		if ( !mw.user.isNamed() ) { // Skip it for unnamed users
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
