const { EditorSelection, EditorView } = require( 'ext.CodeMirror.v6.lib' );

/**
 * [jQuery.textSelection]{@link jQuery.fn.textSelection} implementation for CodeMirror.
 * This is registered to both the textarea and the `.cm-editor` element.
 *
 * @see jQuery.fn.textSelection
 */
class CodeMirrorTextSelection {
	/**
	 * @constructor
	 * @param {EditorView} view
	 */
	constructor( view ) {
		/**
		 * The CodeMirror view.
		 *
		 * @type {EditorView}
		 */
		this.view = view;
		/**
		 * The CodeMirror DOM.
		 *
		 * @type {jQuery}
		 */
		this.$cmDom = $( view.dom );
	}

	/**
	 * Get the contents of the editor.
	 *
	 * @return {string}
	 * @stable to call
	 */
	getContents() {
		return this.view.state.doc.toString();
	}

	/**
	 * Set the contents of the editor.
	 *
	 * @param {string} content
	 * @return {jQuery}
	 * @stable to call
	 */
	setContents( content ) {
		this.dispatch( {
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
	 * @param {Object} [options]
	 * @param {boolean} [options.startAndEnd] Whether to return the start and end of the selection
	 *   instead of the caret position.
	 * @return {number[]|number}
	 * @stable to call
	 */
	getCaretPosition( options = {} ) {
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
	 * @stable to call
	 */
	scrollToCaretPosition() {
		const scrollEffect = EditorView.scrollIntoView( this.view.state.selection.main.head );
		scrollEffect.value.isSnapshot = true;
		this.dispatch( {
			effects: scrollEffect
		} );
		return this.$cmDom;
	}

	/**
	 * Get the selected text.
	 *
	 * @return {string}
	 * @stable to call
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
	 * @param {number} options.start The start of the selection.
	 * @param {number} [options.end=options.start] The end of the selection.
	 * @return {jQuery}
	 * @stable to call
	 */
	setSelection( options ) {
		this.dispatch( {
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
	 * @stable to call
	 */
	replaceSelection( value ) {
		this.dispatch( this.view.state.replaceSelection( value ) );
		return this.$cmDom;
	}

	/**
	 * Encapsulate the selected text with the given values.
	 *
	 * This is intentionally a near-identical implementation to jQuery.textSelection,
	 * except it uses CodeMirror's
	 * [EditorState.changeByRange](https://codemirror.net/docs/ref/#state.EditorState.changeByRange)
	 * when there are multiple selections.
	 *
	 * @todo Add support for 'ownline' option, and complete support for 'selectPeri'.
	 *
	 * @param {Object} options
	 * @param {string} [options.pre] The text to insert before the cursor/selection.
	 * @param {string} [options.post] The text to insert after the cursor/selection.
	 * @param {string} [options.peri] Text to insert between pre and post and select afterwards.
	 * @param {boolean} [options.replace=false] If there is a selection, replace it with peri
	 *   instead of leaving it alone.
	 * @param {boolean} [options.selectPeri=true] Select the peri text if it was inserted.
	 * @param {boolean} [options.splitlines=false] If multiple lines are selected, encapsulate
	 *  each line individually.
	 * @param {number} [options.selectionStart] Position to start selection at.
	 * @param {number} [options.selectionEnd=options.selectionStart] Position to end selection at.
	 * @return {jQuery}
	 * @stable to call
	 */
	encapsulateSelection( options ) {
		let selectedText,
			isSample = false;
		options = Object.assign( {
			pre: '',
			peri: '',
			post: '',
			replace: false,
			selectPeri: true,
			splitlines: false,
			selectionStart: undefined,
			selectionEnd: undefined
		}, options );

		/**
		 * Check if the selected text is the same as the insert text.
		 *
		 * @ignore
		 */
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
				end: options.selectionEnd
			} );
		}

		selectedText = this.getSelection();
		const [ startPos, endPos ] = this.getCaretPosition( { startAndEnd: true } );
		checkSelectedText();
		let insertText = options.pre + selectedText + options.post;
		const lines = selectedText.split( '\n' );
		if ( options.splitlines ) {
			insertText = lines.map(
				( line ) => line.length ? options.pre + line + options.post : ''
			).join( '\n' );
		}

		/**
		 * Use CodeMirror's API when there are multiple selections.
		 *
		 * @see https://codemirror.net/examples/change/
		 */
		if ( this.view.state.selection.ranges.length > 1 ) {
			this.dispatch( this.view.state.changeByRange( ( range ) => ( {
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

		// Leave resultant selection untouched for 'selectPeri' and 'splitlines' options.
		// TODO: jQuery.textSelection should probably have the same behaviour.
		if ( options.selectPeri && ( isSample || options.splitlines ) ) {
			let start = startPos + options.pre.length;
			let end = startPos + options.pre.length + selectedText.length;
			if ( options.splitlines && selectedText.includes( '\n' ) ) {
				start = startPos;
				end = endPos + ( options.pre.length + options.post.length ) *
					lines.filter( Boolean ).length;
			}
			this.setSelection( { start, end } );
		} else {
			this.setSelection( {
				start: startPos + insertText.length
			} );
		}

		return this.$cmDom;
	}

	/**
	 * Dispatch an event to the EditorView, but not if the state is read-only.
	 *
	 * @param {*} args
	 */
	dispatch( ...args ) {
		if ( !this.view.state.readOnly ) {
			this.view.dispatch( ...args );
		}
	}
}

module.exports = CodeMirrorTextSelection;
