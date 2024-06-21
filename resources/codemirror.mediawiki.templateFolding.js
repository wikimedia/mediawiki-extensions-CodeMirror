const {
	EditorState,
	Extension,
	KeyBinding,
	StateField,
	SyntaxNode,
	Tree,
	Tooltip,
	codeFolding,
	ensureSyntaxTree,
	foldEffect,
	foldedRanges,
	keymap,
	showTooltip,
	syntaxTree,
	unfoldAll,
	unfoldEffect
} = require( 'ext.CodeMirror.v6.lib' );
const modeConfig = require( './codemirror.mediawiki.config.js' );

/**
 * Check if a SyntaxNode is a template bracket (`{{` or `}}`)
 *
 * @param {SyntaxNode} node The SyntaxNode to check
 * @return {boolean}
 * @private
 */
const isBracket = ( node ) => node.name.split( '_' ).includes( modeConfig.tags.templateBracket ),
	/**
	 * Check if a SyntaxNode is a template delimiter (`|`)
	 *
	 * @param {SyntaxNode} node The SyntaxNode to check
	 * @return {boolean}
	 * @private
	 */
	isDelimiter = ( node ) => node.name.split( '_' ).includes( modeConfig.tags.templateDelimiter ),
	/**
	 * Check if a SyntaxNode is part of a template, except for the brackets
	 *
	 * @param {SyntaxNode} node The SyntaxNode to check
	 * @return {boolean}
	 * @private
	 */
	isTemplate = ( node ) => /-template[a-z\d-]+ground/u.test( node.name ) && !isBracket( node ),
	/**
	 * Update the stack of opening (+) or closing (-) brackets
	 *
	 * @param {EditorState} state EditorState instance
	 * @param {SyntaxNode} node The SyntaxNode of the bracket
	 * @return {number}
	 * @private
	 */
	stackUpdate = ( state, node ) => state.sliceDoc( node.from, node.from + 1 ) === '{' ? 1 : -1;

/**
 * If the node is a template, find the range of the template parameters
 *
 * @param {EditorState} state EditorState instance
 * @param {number|SyntaxNode} posOrNode Position or node
 * @param {Tree|null} [tree] Syntax tree
 * @return {{from: number, to: number}|null}
 * @private
 */
const foldable = ( state, posOrNode, tree ) => {
	if ( typeof posOrNode === 'number' ) {
		tree = ensureSyntaxTree( state, posOrNode );
	}
	if ( !tree ) {
		return null;
	}
	/** @type {SyntaxNode} */
	let node;
	if ( typeof posOrNode === 'number' ) {
		// Find the initial template node on both sides of the position
		node = tree.resolve( posOrNode, -1 );
		if ( !isTemplate( node ) ) {
			node = tree.resolve( posOrNode, 1 );
		}
	} else {
		node = posOrNode;
	}
	if ( !isTemplate( node ) ) {
		// Not a template
		return null;
	}
	let { prevSibling, nextSibling } = node,
		/** The stack of opening (+) or closing (-) brackets */
		stack = 1,
		/** The first delimiter */
		delimiter = isDelimiter( node ) ? node : null;
	while ( nextSibling ) {
		if ( isBracket( nextSibling ) ) {
			stack += stackUpdate( state, nextSibling );
			if ( stack === 0 ) {
				// The closing bracket of the current template
				break;
			}
		} else if ( !delimiter && stack === 1 && isDelimiter( nextSibling ) ) {
			// The first delimiter of the current template so far
			delimiter = nextSibling;
		}
		( { nextSibling } = nextSibling );
	}
	if ( !nextSibling ) {
		// The closing bracket of the current template is missing
		return null;
	}
	stack = -1;
	while ( prevSibling ) {
		if ( isBracket( prevSibling ) ) {
			stack += stackUpdate( state, prevSibling );
			if ( stack === 0 ) {
				// The opening bracket of the current template
				break;
			}
		} else if ( stack === -1 && isDelimiter( prevSibling ) ) {
			// The first delimiter of the current template so far
			delimiter = prevSibling;
		}
		( { prevSibling } = prevSibling );
	}
	/** The end of the first delimiter */
	const from = delimiter && delimiter.to,
		/** The start of the closing bracket */
		to = nextSibling.from;
	if ( from && from < to ) {
		return { from, to };
	}
	return null;
};

/**
 * Create a tooltip for folding a template
 *
 * @param {EditorState} state EditorState instance
 * @return {Tooltip|null}
 * @private
 */
const create = ( state ) => {
	const { selection: { main: { head } } } = state,
		range = foldable( state, head );
	if ( range ) {
		const { from, to } = range;
		let folded = false;
		// Check if the range is already folded
		foldedRanges( state ).between( from, to, ( i, j ) => {
			if ( i === from && j === to ) {
				folded = true;
			}
		} );
		return folded ?
			null :
			{
				pos: head,
				above: true,
				create( view ) {
					const dom = document.createElement( 'div' );
					dom.className = 'cm-tooltip-fold';
					dom.textContent = '\uff0d';
					dom.title = mw.msg( 'codemirror-fold-template' );
					dom.onclick = () => {
						view.dispatch( {
							effects: foldEffect.of( { from, to } ),
							selection: { anchor: to }
						} );
						dom.remove();
					};
					return { dom };
				}
			};
	}
	return null;
};

/**
 * @type {KeyBinding[]}
 * @private
 */
const foldKeymap = [
	{
		// Fold the template at the selection/cursor
		key: 'Ctrl-Shift-[',
		mac: 'Cmd-Alt-[',
		run( view ) {
			const { state } = view,
				tree = ensureSyntaxTree( state, view.viewport.to );
			if ( !tree ) {
				return false;
			}
			const effects = [],
				{ selection: { ranges } } = state;
			/** The rightmost position of all selections, to be updated with folding */
			let anchor = Math.max( ...ranges.map( ( { to } ) => to ) );
			for ( const { from, to } of ranges ) {
				let node;
				if ( from === to ) {
					// No selection, try both sides of the cursor position
					node = tree.resolve( from, -1 );
				}
				if ( !node || !isTemplate( node ) ) {
					node = tree.resolve( from, 1 );
				}
				while ( node && node.from <= to ) {
					const range = foldable( state, node, tree );
					if ( range ) {
						effects.push( foldEffect.of( range ) );
						node = tree.resolve( range.to, 1 );
						// Update the anchor with the end of the last folded range
						anchor = Math.max( anchor, range.to );
						continue;
					}
					node = node.nextSibling;
				}
			}
			if ( effects.length > 0 ) {
				const dom = view.dom.querySelector( '.cm-tooltip-fold' );
				if ( dom ) {
					dom.remove();
				}
				// Fold the template(s) and update the cursor position
				view.dispatch( { effects, selection: { anchor } } );
				return true;
			}
			return false;
		}
	},
	{
		// Unfold the template at the selection/cursor
		key: 'Ctrl-Shift-]',
		mac: 'Cmd-Alt-]',
		run( view ) {
			const { state } = view,
				{ selection } = state,
				effects = [],
				folded = foldedRanges( state );
			for ( const { from, to } of selection.ranges ) {
				// Unfold any folded range at the selection
				folded.between( from, to, ( i, j ) => {
					effects.push( unfoldEffect.of( { from: i, to: j } ) );
				} );
			}
			if ( effects.length > 0 ) {
				// Unfold the template(s) and redraw the selections
				view.dispatch( { effects, selection } );
				return true;
			}
			return false;
		}
	},
	{
		// Fold all templates in the document
		key: 'Ctrl-Alt-[',
		run( view ) {
			const { state } = view,
				tree = syntaxTree( state ),
				effects = [];
			/** The rightmost position of all selections, to be updated with folding */
			let anchor = Math.max( ...state.selection.ranges.map( ( { to } ) => to ) ),
				node = tree.topNode.firstChild;
			while ( node ) {
				const range = foldable( state, node, tree );
				if ( range ) {
					effects.push( foldEffect.of( range ) );
					const { from, to } = range;
					node = tree.resolve( to, 1 );
					if ( from <= anchor && to > anchor ) {
						// Update the anchor with the end of the last folded range
						anchor = to;
					}
					continue;
				}
				node = node.nextSibling;
			}
			if ( effects.length > 0 ) {
				const dom = view.dom.querySelector( '.cm-tooltip-fold' );
				if ( dom ) {
					dom.remove();
				}
				// Fold the template(s) and update the cursor position
				view.dispatch( { effects, selection: { anchor } } );
				return true;
			}
			return false;
		}
	},
	{ key: 'Ctrl-Alt-]', run: unfoldAll }
];

/**
 * CodeMirror extension providing
 * [template folding](https://www.mediawiki.org/wiki/Help:Extension:CodeMirror#Template_folding)
 * for the MediaWiki mode. This automatically applied when using {@link CodeMirrorModeMediaWiki}.
 *
 * @module CodeMirrorTemplateFolding
 * @type {Extension}
 */
const templateFoldingExtension = [
	codeFolding( {
		placeholderDOM( view ) {
			const element = document.createElement( 'span' );
			element.textContent = '…';
			element.setAttribute( 'aria-label', mw.msg( 'codemirror-folded-code' ) );
			element.title = mw.msg( 'codemirror-unfold' );
			element.className = 'cm-foldPlaceholder';
			element.onclick = ( { target } ) => {
				const pos = view.posAtDOM( target ),
					{ state } = view,
					{ selection } = state;
				foldedRanges( state ).between( pos, pos, ( from, to ) => {
					if ( from === pos ) {
						// Unfold the template and redraw the selections
						view.dispatch( { effects: unfoldEffect.of( { from, to } ), selection } );
					}
				} );
			};
			return element;
		}
	} ),
	/** @see https://codemirror.net/examples/tooltip/ */
	StateField.define( {
		create,
		update( tooltip, { state, docChanged, selection } ) {
			return docChanged || selection ? create( state ) : tooltip;
		},
		provide( f ) {
			return showTooltip.from( f );
		}
	} ),
	keymap.of( foldKeymap )
];

module.exports = templateFoldingExtension;
