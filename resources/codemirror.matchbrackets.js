const {
	Config,
	Decoration,
	EditorState,
	EditorView,
	Extension,
	MatchResult,
	SyntaxNode,
	bracketMatching,
	matchBrackets,
	syntaxTree
} = require( 'ext.CodeMirror.v6.lib' );

/**
 * Find surrounding brackets in the syntax tree.
 *
 * @param {SyntaxNode|null} node
 * @param {number} pos
 * @param {string} brackets
 * @return {MatchResult|undefined}
 * @internal
 * @private
 */
const findSurroundingBrackets = ( node, pos, brackets ) => {
	let parent = node;
	while ( parent ) {
		const { firstChild, lastChild } = parent;
		if ( firstChild && lastChild ) {
			const i = brackets.indexOf( firstChild.name ),
				j = brackets.indexOf( lastChild.name );
			if (
				i !== -1 && j !== -1 && i % 2 === 0 && j % 2 === 1 &&
				firstChild.from < pos && lastChild.to > pos
			) {
				return { start: firstChild, end: lastChild, matched: true };
			}
		}
		( { parent } = parent );
	}
	return undefined;
};

/**
 * Find surrounding brackets in the plain text.
 *
 * @param {EditorState} state
 * @param {number} pos
 * @param {Config} config
 * @return {MatchResult|null}
 * @internal
 * @private
 */
const findSurroundingPlainBrackets = ( state, pos, config ) => {
	const { brackets, maxScanDistance } = config,
		re = new RegExp(
			`[${
				[ ...brackets ].filter( ( _, i ) => i % 2 )
					.map( ( c ) => c === ']' ? '\\]' : c )
					.join( '' )
			}]`,
			'g'
		),
		str = state.sliceDoc( pos, pos + maxScanDistance );
	let mt = re.exec( str );
	while ( mt ) {
		const result = matchBrackets( state, pos + mt.index + 1, -1, config );
		if ( result && result.end && result.end.to <= pos ) {
			return result;
		}
		mt = re.exec( str );
	}
	return null;
};

/**
 * Try to select between matching brackets on one side of the position.
 *
 * @param {EditorState} state
 * @param {number} pos
 * @param {number} dir
 * @param {Config} config
 * @param {boolean} inside
 * @return {Object<number>|false}
 * @internal
 * @private
 */
const trySelectMatchingBrackets = ( state, pos, dir, config, inside = false ) => {
	if ( pos < 0 ) {
		return false;
	}
	const match = matchBrackets( state, pos, dir, config ) || false,
		rightInside = dir === 1 === inside;
	return match && match.matched && {
		anchor: match.start[ rightInside ? 'to' : 'from' ],
		head: match.end[ rightInside ? 'from' : 'to' ]
	};
};

/**
 * Select between matching brackets.
 *
 * @param {EditorState} state
 * @param {number} pos
 * @param {Config} config
 * @return {Object<number>|false}
 * @internal
 * @private
 */
const selectMatchingBrackets = (
	state,
	pos,
	config
) => trySelectMatchingBrackets( state, pos, -1, config ) ||
	trySelectMatchingBrackets( state, pos, 1, config ) ||
	trySelectMatchingBrackets( state, pos + 1, -1, config, true ) ||
	trySelectMatchingBrackets( state, pos - 1, 1, config, true );

/**
 * Highlight surrounding brackets in addition to matching brackets.
 *
 * @param {Config} configs
 * @return {Extension}
 * @internal
 * @private
 */
module.exports = ( configs ) => {
	const extension = bracketMatching( configs ),
		[ { facet }, [ field ] ] = extension;
	Object.assign( field, {
		updateF( value, { state, docChanged, selection } ) {
			if ( !docChanged && !selection ) {
				return value;
			}
			const decorations = [],
				config = state.facet( facet ),
				{ afterCursor, brackets, renderMatch, exclude } = config;
			for ( const { empty, head } of state.selection.ranges ) {
				if ( !empty ) {
					continue;
				}
				const tree = syntaxTree( state ),
					excluded = exclude && exclude( state, head ),
					match = !excluded && (
						matchBrackets( state, head, -1, config ) ||
						head > 0 && matchBrackets( state, head - 1, 1, config ) ||
						afterCursor && (
							matchBrackets( state, head, 1, config ) ||
							head < state.doc.length && matchBrackets( state, head + 1, -1, config )
						)
					) ||
					findSurroundingBrackets( tree.resolveInner( head, -1 ), head, brackets ) ||
					afterCursor &&
					findSurroundingBrackets( tree.resolveInner( head, 1 ), head, brackets ) ||
					!excluded && findSurroundingPlainBrackets( state, head, config );
				if ( match ) {
					decorations.push( ...renderMatch( match, state ) );
				}
			}
			return Decoration.set( decorations, true );
		}
	} );
	return [
		extension,
		EditorView.domEventHandlers( {
			dblclick( e, view ) {
				const pos = view.posAtCoords( e ),
					{ state } = view,
					config = state.facet( facet );
				if ( pos === null || config.exclude && config.exclude( state, pos ) ) {
					return false;
				}
				const selection = selectMatchingBrackets( state, pos, config );
				if ( selection ) {
					view.dispatch( { selection } );
					return true;
				}
				return false;
			}
		} )
	];
};
