const { syntaxTree, Decoration, Range, ViewPlugin } = require( 'ext.CodeMirror.v6.lib' );

const doctag = Decoration.mark( { class: 'cm-doctag' } ),
	doctagType = Decoration.mark( { class: 'cm-doctag-type' } );

/**
 * Mark the tag and type (if any) in a JSDoc/LDoc comment
 *
 * @param {Range[]} decorations
 * @param {number} from The position of the start of the comment
 * @param {string[]} mt
 * @param {number} [offset=0] An optional offset to expand the decoration.
 * @return {number} The position of the end of the tag, or the type if any.
 * @internal
 * @private
 */
const markDocTagType = ( decorations, from, mt, offset = 0 ) => {
	const { input, index } = mt,
		// The first capture group is leading whitespace.
		start = index + mt[ 1 ].length,
		// The second capture group is the tag `@tag`.
		end = start + mt[ 2 ].length;
	decorations.push( doctag.range( from + start, from + end ) );
	// The third capture group is the opening brace of the type `{type}`, if any.
	if ( mt[ 3 ] ) {
		const re = /[{}]/gu,
			left = end + mt[ 3 ].length;
		re.lastIndex = left;
		let m = re.exec( input ),
			balance = 1;
		while ( m ) {
			balance += m[ 0 ] === '{' ? 1 : -1;
			if ( balance === 0 ) {
				if ( offset || m.index > left ) {
					decorations.push(
						doctagType.range( from + left - offset, from + m.index + offset )
					);
				}
				return m.index + 1;
			}
			m = re.exec( input );
		}
	}
	return end;
};

const getViewPlugin = ( mark ) => ViewPlugin.fromClass( class {
	constructor( { state, visibleRanges } ) {
		this.tree = syntaxTree( state );
		this.decorations = mark( this.tree, visibleRanges, state );
	}

	update( { docChanged, viewportChanged, state, view: { visibleRanges } } ) {
		const tree = syntaxTree( state );
		if ( docChanged || viewportChanged || tree !== this.tree ) {
			this.tree = tree;
			this.decorations = mark( tree, visibleRanges, state );
		}
	}
}, {
	decorations: ( v ) => v.decorations
} );

module.exports = {
	doctag,
	doctagType,
	markDocTagType,
	getViewPlugin
};
