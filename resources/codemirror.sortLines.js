const { EditorState, EditorView } = require( 'ext.CodeMirror.lib' );

/**
 * Provides line sorting functionality for CodeMirror.
 *
 * This allows customization of sorting options via {@link CodeMirrorSortLines#setOptions}.
 * See {@link Intl.CollatorOptions} for available locale-friendly sorting options.
 *
 * @see {@link Intl.CollatorOptions} for available sorting options.
 *
 * @example
 * // This can be made into a user script, default gadget for wiki, etc.
 * mw.hook( 'ext.CodeMirror.ready' ).add( ( cm ) => {
 *   // Set sorting options to be case-sensitive and ignore punctuation.
 *   cm.sortLines.setOptions( { sensitivity: 'case', ignorePunctuation: true } );
 * } );
 */
class CodeMirrorSortLines {

	/**
	 * The constructor is internal. An instance can be accessed via {@link CodeMirror#sortLines}.
	 *
	 * @internal
	 * @hideconstructor
	 */
	constructor() {
		/**
		 * @type {Intl.CollatorOptions}
		 * @private
		 */
		this.customOptions = {};
	}

	/** @type {Intl.CollatorOptions} */
	get defaultOptions() {
		return { sensitivity: 'base' };
	}

	/**
	 * Set sorting options used by line-sorting commands.
	 *
	 * @param {Intl.CollatorOptions} [options={}]
	 */
	setOptions( options = {} ) {
		this.customOptions = Object.assign( {}, this.customOptions, options );
	}

	/**
	 * Get the effective sorting options.
	 *
	 * @type {Intl.CollatorOptions}
	 */
	get options() {
		return Object.assign( {}, this.defaultOptions, this.customOptions );
	}

	/**
	 * Reset sorting options to defaults.
	 */
	resetOptions() {
		this.customOptions = {};
	}

	/**
	 * @param {string} text
	 * @param {Intl.Collator} collator
	 * @param {boolean} descending
	 * @return {string}
	 * @private
	 */
	sortChunk( text, collator, descending ) {
		const lines = text.length ? text.split( '\n' ) : [];
		const sorted = lines.sort( collator.compare );
		if ( descending ) {
			sorted.reverse();
		}
		return sorted.join( '\n' );
	}

	/**
	 * Build the document changes needed to sort selected lines.
	 *
	 * @param {EditorState} state
	 * @param {boolean} [descending=false]
	 * @return {Array<{from:number,to:number,insert:string}>}
	 * @private
	 */
	getSortChanges( state, descending = false ) {
		const ranges = state.selection.ranges.slice().sort( ( a, b ) => a.from - b.from );

		// Do nothing if no lines are selected.
		if ( ranges.every( ( range ) => range.empty ) ) {
			return [];
		}

		const collator = new Intl.Collator( undefined, this.options );

		/** @type {Array<{from:number,to:number,insert:string}>} */
		const changes = [];
		let lastTo = -1;
		for ( const range of ranges ) {
			if ( range.empty ) {
				continue;
			}

			const startLine = state.doc.lineAt( range.from );
			let endLine = state.doc.lineAt( range.to );

			// If the cursor ends at the start of a trailing line,
			// and it's not the same line we started on, exclude that trailing line.
			if ( range.to === endLine.from && endLine.number > startLine.number ) {
				endLine = state.doc.lineAt( range.to - 1 );
			}

			const { from } = startLine;
			const { to } = endLine;

			if ( from <= lastTo ) {
				continue;
			}

			const text = state.doc.sliceString( from, to );
			const sortedText = this.sortChunk( text, collator, descending );
			if ( sortedText !== text ) {
				changes.push( { from, to, insert: sortedText } );
			}

			lastTo = to;
		}

		return changes;
	}

	/**
	 * Sort selected lines in ascending or descending order.
	 *
	 * @param {EditorView} view
	 * @param {boolean} [descending=false]
	 * @return {boolean}
	 * @private
	 */
	sort( view, descending = false ) {
		const { state, dispatch } = view;
		const changes = this.getSortChanges( state, descending );
		if ( !changes.length ) {
			return false;
		}
		dispatch( { changes } );
		return true;
	}

	/**
	 * Sort selected lines in ascending order.
	 *
	 * @param {EditorView} view
	 * @return {boolean}
	 * @internal
	 */
	sortAscending( view ) {
		return this.sort( view, false );
	}

	/**
	 * Sort selected lines in descending order.
	 *
	 * @param {EditorView} view
	 * @return {boolean}
	 * @internal
	 */
	sortDescending( view ) {
		return this.sort( view, true );
	}
}

module.exports = CodeMirrorSortLines;
