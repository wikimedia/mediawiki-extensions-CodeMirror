const {
	Config,
	Decoration,
	EditorSelection,
	EditorState,
	EditorView,
	Extension,
	Facet,
	bracketMatching,
	matchBrackets
} = require( 'ext.CodeMirror.lib' );
const { findBracketMatch, tryMatchBrackets } = require( './codemirror.matchbrackets.util.js' );

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
 * Select the whole line block containing the matching brackets.
 *
 * @param {EditorState} state
 * @param {number} pos
 * @param {Config} config
 * @return {Object<number>|false}
 * @internal
 * @private
 */
const selectLineBlock = ( state, pos, config ) => {
	const { doc } = state,
		matching = tryMatchBrackets( state, pos, config );
	if ( !matching || !matching.matched ) {
		return false;
	}
	const { start, end } = matching,
		a = doc.lineAt( start.from ),
		b = doc.lineAt( end.from ),
		dir = a.from < b.from;
	return {
		anchor: ( dir ? a : b ).from,
		head: Math.min( doc.length, ( dir ? b : a ).to + 1 )
	};
};

/**
 * Select the whole document.
 *
 * @param {EditorState} state
 * @return {Object<number>|false}
 * @internal
 * @private
 */
const selectDocument = ( state ) => ( { anchor: 0, head: state.doc.length } );

const clickSelection = {
	0: selectDocument,
	2: selectMatchingBrackets,
	3: selectLineBlock
};

/**
 * Click handler that selects matching brackets on double/triple click.
 *
 * @param {MouseEvent} e
 * @param {EditorView} view
 * @param {Facet} facet
 * @param {Function} select
 * @return {EditorSelection|false}
 * @internal
 * @private
 */
const clickHandler = ( e, view, facet, select ) => {
	const pos = view.posAtCoords( e ),
		{ state } = view,
		config = state.facet( facet );
	if (
		select !== selectDocument &&
		( pos === null || config.exclude && config.exclude( state, pos ) )
	) {
		return false;
	}
	const range = select( state, pos, config );
	if ( range ) {
		const selection = EditorSelection.single( range.anchor, range.head );
		view.dispatch( { selection } );
		return selection;
	}
	return false;
};

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
				{ renderMatch } = config;
			for ( const { empty, head } of state.selection.ranges ) {
				if ( !empty ) {
					continue;
				}
				const match = findBracketMatch( state, head, config );
				if ( match ) {
					decorations.push( ...renderMatch( match, state ) );
				}
			}
			return Decoration.set( decorations, true );
		}
	} );
	let sel = false;
	return [
		extension,
		EditorView.domEventHandlers( {
			mousedown( e, view ) {
				// Make a loop for the mousedown behavior.
				const n = e.detail % 4;
				sel = e.detail > 0 && n in clickSelection &&
					clickHandler( e, view, facet, clickSelection[ n ] );
				return Boolean( sel );
			},
			mouseup() {
				sel = false;
			},
			mousemove( e, view ) {
				if ( !sel ) {
					return;
				}
				const head = view.posAtCoords( e ),
					{ from, to } = sel.main;
				if ( head === null || head >= from && head <= to ) {
					return;
				}
				view.dispatch( {
					selection: { head, anchor: head < from ? to : from }
				} );
				return true;
			}
		} )
	];
};
