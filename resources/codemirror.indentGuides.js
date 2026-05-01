const {
	EditorSelection,
	EditorView,
	Extension,
	RectangleMarker,
	layer
} = require( 'ext.CodeMirror.lib' );

/**
 * Get the indentation marker for the given position and width.
 *
 * @param {EditorView} view
 * @param {number} pos
 * @param {number} width
 * @return {RectangleMarker}
 * @internal
 * @private
 */
const getIndentMarker = ( view, pos, width ) => {
	const [ marker ] = RectangleMarker.forRange( view, 'cm-indent-guide', EditorSelection.cursor( pos ) );
	marker.width = width - 2;
	return marker;
};

/**
 * Show indentation guides for the document.
 *
 * @type {Extension}
 * @internal
 * @private
 */
module.exports = ( fontClass ) => layer( {
	above: false,
	class: fontClass || '',
	markers( view ) {
		const markers = [],
			{ visibleRanges, state } = view,
			{ doc } = state,
			{ lines } = doc;
		for ( const { from, to } of visibleRanges ) {
			const blankLines = [];
			let prevWidth = 0;
			for ( let line = doc.lineAt( from ); line.from < to; ) {
				const { text, from: f, number } = line;
				if ( f !== view.lineBlockAt( f ).from ) {
					// Skip folded lines.
				} else if ( text.trim() ) {
					const coordsFrom = view.coordsAtPos( f ),
						coordsIndent = view.coordsAtPos( f + /^\s*/.exec( text )[ 0 ].length ),
						width = coordsFrom && coordsIndent ?
							coordsIndent.left - coordsFrom.left :
							0;
					if ( blankLines.length ) {
						const min = Math.min( prevWidth, width );
						if ( min ) {
							for ( const pos of blankLines ) {
								markers.push( getIndentMarker( view, pos, min ) );
							}
							blankLines.length = 0;
						}
					}
					prevWidth = width;
					if ( width ) {
						markers.push( getIndentMarker( view, f, width ) );
					}
				} else {
					blankLines.push( f );
				}
				if ( number === lines ) {
					break;
				}
				line = doc.line( number + 1 );
			}
		}
		return markers;
	},
	update( { docChanged, viewportChanged } ) {
		return docChanged || viewportChanged;
	}
} );
