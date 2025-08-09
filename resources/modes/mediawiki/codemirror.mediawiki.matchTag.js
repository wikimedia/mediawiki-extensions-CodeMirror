const {
	EditorState,
	SyntaxNode,
	ensureSyntaxTree
} = require( 'ext.CodeMirror.v6.lib' );
const mwModeConfig = require( './codemirror.mediawiki.config.js' );

const isTag = ( { name } ) => {
	const names = name.split( '_' );
	return [
		'htmlTagAttribute',
		'htmlTagAttributeValue',
		'htmlTagName',
		'extTagAttribute',
		'extTagAttributeValue',
		'extTagName'
	]
		.some( ( type ) => names.includes( mwModeConfig.tags[ type ] ) );
};
/**
 * @param {string} s
 * @return {Function}
 * @private
 */
const isTagComponent = ( s ) => (
	/**
	 * @param {SyntaxNode} node
	 * @param {string} type
	 * @return {boolean}
	 */
	( node, type ) => node.name.split( '_' ).includes( mwModeConfig.tags[ `${ type }Tag${ s }` ] )
);
const isBracket = isTagComponent( 'Bracket' ),
	isName = isTagComponent( 'Name' );
/**
 * @param {SyntaxNode} node
 * @param {string} type
 * @param {EditorState} state
 * @param {boolean} first `/>` if true, `</` if false
 * @return {boolean}
 * @private
 */
const isClosing = ( node, type, state, first ) => isBracket( node, type ) &&
	state.sliceDoc( node.from, node.to )[ first ? 'endsWith' : 'startsWith' ]( '/' );
/**
 * @param {EditorState} state
 * @param {SyntaxNode} node
 * @return {string}
 * @private
 */
const getName = ( state, node ) => state.sliceDoc( node.from, node.to ).trim().toLowerCase();

/**
 * Class representing a tag along with its placement and state.
 *
 * @ignore
 */
class Tag {
	get closing() {
		return isClosing( this.first, this.type, this.state, true );
	}

	get selfClosing() {
		return this.name in mwModeConfig.implicitlyClosedHtmlTags ||
			this.type === 'ext' && isClosing( this.last, this.type, this.state );
	}

	get from() {
		const { first: { from, to }, state } = this;
		return from + state.sliceDoc( from, to ).lastIndexOf( '<' );
	}

	get to() {
		const { last: { from, to }, state } = this;
		return from + state.sliceDoc( from, to ).indexOf( '>' ) + 1;
	}

	/**
	 * @param {string} type
	 * @param {string} name
	 * @param {SyntaxNode} first
	 * @param {SyntaxNode} last
	 * @param {EditorState} state
	 */
	constructor( type, name, first, last, state ) {
		this.type = type;
		this.name = name;
		this.first = first;
		this.last = last;
		this.state = state;
	}
}

/**
 * Get tag information
 *
 * @param {EditorState} state
 * @param {SyntaxNode} node
 * @return {Tag}
 * @private
 */
const getTag = ( state, node ) => {
	const names = node.name.split( '_' ),
		type = [ 'extTagAttribute', 'extTagAttributeValue', 'extTagName', 'extTagBracket' ]
			.some( ( t ) => names.includes( mwModeConfig.tags[ t ] ) ) ? 'ext' : 'html';
	let { nextSibling, prevSibling } = node,
		nameNode = isName( node, type ) ? node : null;
	while ( nextSibling && !isBracket( nextSibling, type ) ) {
		( { nextSibling } = nextSibling );
	}
	if ( !nextSibling ||
		isBracket( nextSibling, type ) && state.sliceDoc( nextSibling.from, nextSibling.from + 1 ) === '<' ) {
		return null;
	}
	while ( prevSibling && !isBracket( prevSibling, type ) ) {
		if ( !nameNode ) {
			nameNode = isName( prevSibling, type ) ? prevSibling : null;
		}
		( { prevSibling } = prevSibling );
	}
	const name = getName( state, nameNode );
	return new Tag( type, name, prevSibling, nextSibling, state );
};

/**
 * Search for matching tags
 *
 * @param {EditorState} state
 * @param {Tag} origin
 * @return {Tag|null}
 * @private
 */
const searchTag = ( state, origin ) => {
	const { type, name, closing } = origin,
		siblingGetter = closing ? 'prevSibling' : 'nextSibling',
		endGetter = closing ? 'first' : 'last';
	let stack = closing ? -1 : 1,
		sibling = origin[ endGetter ][ siblingGetter ];
	while ( sibling ) {
		if ( isName( sibling, type ) && getName( state, sibling ) === name ) {
			const tag = getTag( state, sibling );
			if ( tag ) {
				stack += tag.closing ? -1 : 1;
				if ( stack === 0 ) {
					return tag;
				}
				sibling = tag[ endGetter ];
			}
		}
		sibling = sibling[ siblingGetter ];
	}
	return null;
};

/**
 * Get result of matching tags
 *
 * @param {EditorState} state
 * @param {number} pos
 * @return {{matched: boolean, start: Tag, end: Tag}|{matched: boolean, start: Tag}}
 * @private
 */
const matchTag = ( state, pos ) => {
	const tree = ensureSyntaxTree( state, pos );
	if ( !tree ) {
		return null;
	}
	let node = tree.resolve( pos, -1 );
	if ( !isTag( node ) ) {
		node = tree.resolve( pos, 1 );
		if ( !isTag( node ) ) {
			return null;
		}
	}
	const start = getTag( state, node );
	if ( !start ) {
		return null;
	} else if ( start.selfClosing ) {
		return { matched: true, start };
	}
	const end = searchTag( state, start );
	return end ? { matched: true, start, end } : { matched: false, start };
};

module.exports = { getTag, matchTag };
