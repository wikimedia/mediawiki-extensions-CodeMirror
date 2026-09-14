const { Decoration, EditorView, Extension } = require( 'ext.CodeMirror.lib' );
const { getViewPlugin } = require( './codemirror.doctag.js' );

const linkDeco = Decoration.mark( { class: 'cm-link' } );

/**
 * CodeMirror extension that opens links by modifier-clicking.
 *
 * @param {Function} resolveLinkAt Function that returns a link at a position, or null if none.
 * @return {Extension}
 * @internal
 * @private
 */
const getOpenLinksDecoration = ( resolveLinkAt ) => [
	getViewPlugin( ( tree, visibleRanges, state ) => {
		const deco = [];
		for ( const { from, to } of visibleRanges ) {
			tree.iterate( {
				from,
				to,
				enter( node ) {
					const resolved = resolveLinkAt( state, node.from );
					if ( resolved ) {
						deco.push( linkDeco.range( resolved.from, resolved.to ) );
					}
				}
			} );
		}
		return Decoration.set( deco );
	} ),
	EditorView.theme( {
		'.cm-link, .cm-link > span': {
			color: 'var(--color-progressive)',

			'&:hover': {
				textDecoration: 'underline'
			}
		},

		'.cm-mw-open-links[ data-open-links ]': {
			'& .cm-link, & .cm-link > span': {
				cursor: 'pointer'
			}
		}
	} )
];

module.exports = getOpenLinksDecoration;
