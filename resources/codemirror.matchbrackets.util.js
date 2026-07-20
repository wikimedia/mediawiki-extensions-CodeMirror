const {
	Config,
	EditorState,
	MatchResult,
	SyntaxNode,
	matchBrackets,
	syntaxTree
} = require( 'ext.CodeMirror.lib' );

/**
 * Headless bracket-matching helpers (no EditorView), shared by the bracket-matching view plugin
 * and consumers such as the VisualEditor custom-highlight controller.
 */

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
 * Find matching brackets in all possible directions.
 *
 * @param {EditorState} state
 * @param {number} pos
 * @param {Config} config
 * @return {MatchResult|false|null}
 * @internal
 * @private
 */
const tryMatchBrackets = ( state, pos, config ) => matchBrackets( state, pos, -1, config ) ||
	pos > 0 && matchBrackets( state, pos - 1, 1, config ) ||
	matchBrackets( state, pos, 1, config ) ||
	pos < state.doc.length && matchBrackets( state, pos + 1, -1, config );

/**
 * Find the matching-bracket result at a position, combining the direct match, syntax-tree
 * surrounding brackets and a plain-text scan.
 *
 * @param {EditorState} state
 * @param {number} pos
 * @param {Config} config Bracket-matching config ({@link matchBrackets} options)
 * @return {MatchResult|null}
 * @internal
 * @private
 */
const findBracketMatch = ( state, pos, config ) => {
	const { brackets, exclude } = config,
		tree = syntaxTree( state ),
		excluded = exclude && exclude( state, pos );
	return ( !excluded && tryMatchBrackets( state, pos, config ) ) ||
		findSurroundingBrackets( tree.resolveInner( pos, -1 ), pos, brackets ) ||
		findSurroundingBrackets( tree.resolveInner( pos, 1 ), pos, brackets ) ||
		( !excluded && findSurroundingPlainBrackets( state, pos, config ) ) ||
		null;
};

module.exports = { findBracketMatch, tryMatchBrackets };
