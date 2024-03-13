import { EditorView } from '@codemirror/view';
import { EditorSelection } from '@codemirror/state';

/**
 * jQuery.textSelection implementation for CodeMirror.
 *
 * @see jQuery.fn.textSelection
 * @class CodemirrorTextSelection
 * @property {EditorView} view
 * @property {jQuery} $cmDom
 */
export default class CodemirrorTextSelection {
	/**
	 * @constructor
	 * @param {EditorView} view
	 */
	constructor( view ) {
		this.view = view;
		this.$cmDom = $( view.dom );
	}

	/**
	 * Get the contents of the editor.
	 *
	 * @return {string}
	 */
	getContents() {
		return this.view.state.doc.toString();
	}

	/**
	 * Set the contents of the editor.
	 *
	 * @param {string} content
	 * @return {jQuery}
	 */
	setContents( content ) {
		this.view.dispatch( {
			changes: {
				from: 0,
				to: this.view.state.doc.length,
				insert: content
			}
		} );
		return this.$cmDom;
	}

	/**
	 * Get the current caret position.
	 *
	 * @param {Object} options
	 * @return {number[]|number}
	 */
	getCaretPosition( options ) {
		if ( !options.startAndEnd ) {
			return this.view.state.selection.main.head;
		}
		return [
			this.view.state.selection.main.from,
			this.view.state.selection.main.to
		];
	}

	/**
	 * Scroll the editor to the current caret position.
	 *
	 * @return {jQuery}
	 */
	scrollToCaretPosition() {
		const scrollEffect = EditorView.scrollIntoView( this.view.state.selection.main.head );
		scrollEffect.value.isSnapshot = true;
		this.view.dispatch( {
			effects: scrollEffect
		} );
		return this.$cmDom;
	}

	/**
	 * Get the selected text.
	 *
	 * @return {string}
	 */
	getSelection() {
		return this.view.state.sliceDoc(
			this.view.state.selection.main.from,
			this.view.state.selection.main.to
		);
	}

	/**
	 * Set the selected text.
	 *
	 * @param {Object} options
	 * @return {jQuery}
	 */
	setSelection( options ) {
		this.view.dispatch( {
			selection: { anchor: options.start, head: ( options.end || options.start ) }
		} );
		this.view.focus();
		return this.$cmDom;
	}

	/**
	 * Replace the selected text with the given value.
	 *
	 * @param {string} value
	 * @return {jQuery}
	 */
	replaceSelection( value ) {
		this.view.dispatch(
			this.view.state.replaceSelection( value )
		);
		return this.$cmDom;
	}

	/**
	 * Encapsulate the selected text with the given values.
	 *
	 * This is intentionally a near-identical implementation to jQuery.textSelection,
	 * except it uses CodeMirror's EditorState.changeByRange when there are multiple selections.
	 *
	 * @see jQuery.fn.textSelection.encapsulateSelection
	 * @todo Add support for 'ownline', 'selectPeri' and 'splitlines' options.
	 *
	 * @param {Object} options
	 * @return {jQuery}
	 */
	encapsulateSelection( options ) {
		let selectedText,
			isSample = false;

		const checkSelectedText = () => {
			if ( !selectedText ) {
				selectedText = options.peri;
				isSample = true;
			} else if ( options.replace ) {
				selectedText = options.peri;
			} else {
				while ( selectedText.charAt( selectedText.length - 1 ) === ' ' ) {
					// Exclude ending space char
					selectedText = selectedText.slice( 0, -1 );
					options.post += ' ';
				}
				while ( selectedText.charAt( 0 ) === ' ' ) {
					// Exclude prepending space char
					selectedText = selectedText.slice( 1 );
					options.pre = ' ' + options.pre;
				}
			}
		};

		this.view.focus();

		// Set the selection, if applicable.
		if ( options.selectionStart !== undefined ) {
			this.setSelection( {
				start: options.selectionStart,
				end: options.selectionEnd || options.selectionStart
			} );
		}

		selectedText = this.getSelection();
		const [ startPos ] = this.getCaretPosition( { startAndEnd: true } );
		checkSelectedText();
		const insertText = options.pre + selectedText + options.post;

		/**
		 * Use CodeMirror's API when there are multiple selections.
		 *
		 * @see https://codemirror.net/examples/change/
		 */
		if ( this.view.state.selection.ranges.length > 1 ) {
			this.view.dispatch( this.view.state.changeByRange( ( range ) => ( {
				changes: [
					{ from: range.from, insert: options.pre },
					{ from: range.to, insert: options.post }
				],
				range: EditorSelection.range(
					range.to + options.pre.length + options.post.length,
					range.to + options.pre.length + options.post.length
				)
			} ) ) );
			return this.$cmDom;
		}

		this.replaceSelection( insertText );

		if ( isSample && options.selectPeri ) {
			this.setSelection( {
				start: startPos + options.pre.length,
				end: startPos + options.pre.length + selectedText.length
			} );
		} else {
			this.setSelection( {
				start: startPos + insertText.length
			} );
		}

		return this.$cmDom;
	}
}
