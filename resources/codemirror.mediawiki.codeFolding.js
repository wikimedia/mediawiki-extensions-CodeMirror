const {
	EditorState,
	EditorView,
	Extension,
	StateEffect,
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
const mwModeConfig = require( './codemirror.mediawiki.config.js' );
const { getTag, matchTag } = require( './codemirror.mediawiki.matchTag.js' );

const updateSelection = ( pos, { to } ) => Math.max( pos, to ),
	updateAll = ( pos, { from, to } ) => from <= pos && to > pos ? to : pos;

/**
 * Check if a SyntaxNode is among the specified components
 *
 * @param {string[]} keys
 * @return {Function}
 * @private
 */
const isComponent = ( keys ) => (
		/**
		 * @param {SyntaxNode} node
		 * @return {boolean}
		 */
		( node ) => {
			const names = node.name.split( '_' );
			return keys.some( ( key ) => names.includes( mwModeConfig.tags[ key ] ) );
		}
	),
	/**
	 * Check if a SyntaxNode is a template bracket (`{{` or `}}`)
	 *
	 * @param {SyntaxNode} node The SyntaxNode to check
	 * @return {boolean}
	 * @private
	 */
	isTemplateBracket = isComponent( [ 'templateBracket', 'parserFunctionBracket' ] ),
	/**
	 * Check if a SyntaxNode is a template delimiter (`|` or `:`)
	 *
	 * @param {SyntaxNode} node The SyntaxNode to check
	 * @return {boolean}
	 * @private
	 */
	isDelimiter = isComponent( [ 'templateDelimiter', 'parserFunctionDelimiter' ] ),
	/**
	 * Check if a SyntaxNode is an extension tag bracket (`<` or `>`)
	 *
	 * @param {SyntaxNode} node The SyntaxNode to check
	 * @return {boolean}
	 * @private
	 */
	isExtBracket = isComponent( [ 'extTagBracket' ] );

/**
 * Check if a SyntaxNode is part of a template, except for the brackets
 *
 * @param {SyntaxNode} node The SyntaxNode to check
 * @return {boolean}
 * @private
 */
const isTemplate = ( node ) => /-(?:template|ext)[a-z\d-]+ground/.test( node.name ) &&
		!isTemplateBracket( node ),
	/**
	 * Check if a SyntaxNode is part of an extension tag
	 *
	 * @param {SyntaxNode} node The SyntaxNode to check
	 * @param {boolean} [refOnly=false] If true, only check for `<ref>` tags
	 * @return {boolean}
	 * @private
	 */
	isExt = ( node, refOnly ) => refOnly ?
		node.name.includes( 'mw-tag-ref' ) :
		node.name.includes( 'mw-tag-' ) ||
		node.name.split( '_' ).includes( mwModeConfig.tags.extTag );

/**
 * Update the stack of opening (+) or closing (-) braces
 *
 * @param {EditorState} state EditorState instance
 * @param {SyntaxNode} node The SyntaxNode of the brace
 * @return {number[]}
 * @private
 */
const braceStackUpdate = ( state, node ) => {
	const braces = state.sliceDoc( node.from, node.to );
	return [ braces.split( '{{' ).length - 1, 1 - braces.split( '}}' ).length ];
};

/**
 * If the node is a template, find the range of the template parameters
 * If the node is an extension tag, find the range of the tag content
 *
 * @param {EditorState} state EditorState instance
 * @param {number|SyntaxNode} posOrNode Position or node
 * @param {Tree|null} [tree] Syntax tree
 * @param {boolean} [refOnly=false] If true, only return the range if it is a `<ref>` tag
 * @return {{from: number, to: number}|false}
 * @private
 */
const foldable = ( state, posOrNode, tree, refOnly ) => {
	if ( typeof posOrNode === 'number' ) {
		tree = ensureSyntaxTree( state, posOrNode );
	}
	if ( !tree ) {
		return false;
	}
	/** @type {SyntaxNode} */
	let node, nextSibling, prevSibling;
	if ( typeof posOrNode === 'number' ) {
		// Find the initial template node on both sides of the position
		node = tree.resolve( posOrNode, -1 );
		if ( ( refOnly || !isTemplate( node ) ) && !isExt( node, refOnly ) ) {
			node = tree.resolve( posOrNode, 1 );
		}
	} else {
		node = posOrNode;
	}
	if ( refOnly || !isTemplate( node ) ) {
		// Not a template
		if ( isExt( node, refOnly ) ) {
			( { nextSibling } = node );
			while ( nextSibling && !( isExtBracket( nextSibling ) &&
				state.sliceDoc( nextSibling.from, nextSibling.from + 2 ) === '</' ) ) {
				( { nextSibling } = nextSibling );
			}
			// The closing bracket of the extension tag
			if ( nextSibling &&
				( !refOnly || nextSibling.nextSibling && getTag( state, nextSibling.nextSibling ).name === 'ref' )
			) {
				return { from: matchTag( state, nextSibling.to ).end.to, to: nextSibling.from };
			}
		}
		return false;
	}
	( { prevSibling, nextSibling } = node );
	/** The stack of opening (+) or closing (-) brackets */
	let stack = 1,
		/** The first delimiter */
		delimiter = isDelimiter( node ) ? node : null,
		/** The start of the closing bracket */
		to = 0;
	while ( nextSibling ) {
		if ( isTemplateBracket( nextSibling ) ) {
			const [ lbrace, rbrace ] = braceStackUpdate( state, nextSibling );
			stack += rbrace;
			if ( stack <= 0 ) {
				// The closing bracket of the current template
				to = nextSibling.from +
					state.sliceDoc( nextSibling.from, nextSibling.to ).split( '}}' )
						.slice( 0, stack - 1 ).join( '}}' ).length;
				break;
			}
			stack += lbrace;
		} else if ( !delimiter && stack === 1 && isDelimiter( nextSibling ) ) {
			// The first delimiter of the current template so far
			delimiter = nextSibling;
		}
		( { nextSibling } = nextSibling );
	}
	if ( !nextSibling ) {
		// The closing bracket of the current template is missing
		return false;
	}
	stack = -1;
	while ( prevSibling ) {
		if ( isTemplateBracket( prevSibling ) ) {
			const [ lbrace, rbrace ] = braceStackUpdate( state, prevSibling );
			stack += lbrace;
			if ( stack >= 0 ) {
				// The opening bracket of the current template
				break;
			}
			stack += rbrace;
		} else if ( stack === -1 && isDelimiter( prevSibling ) ) {
			// The first delimiter of the current template so far
			delimiter = prevSibling;
		}
		( { prevSibling } = prevSibling );
	}
	/** The end of the first delimiter */
	const from = delimiter && delimiter.to;
	if ( from && from < to ) {
		return { from, to };
	}
	return false;
};

/**
 * Create a tooltip for code folding
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
					dom.title = mw.msg( 'codemirror-fold' );
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
 * Execute the folding effect
 *
 * @param {EditorView} view EditorView instance
 * @param {StateEffect[]} effects StateEffects
 * @param {number} anchor Cursor position
 * @return {boolean}
 * @private
 */
const execute = ( view, effects, anchor ) => {
	if ( effects.length > 0 ) {
		const tooltip = view.dom.querySelector( '.cm-tooltip-fold' );
		if ( tooltip ) {
			tooltip.remove();
		}
		// Fold and update the cursor position
		view.dispatch( { effects, selection: { anchor } } );
		return true;
	}
	return false;
};

/**
 * The rightmost position of all selections, to be updated with folding
 *
 * @param {EditorState} state EditorState instance
 * @return {number}
 * @private
 */
const getAnchor = ( state ) => Math.max( ...state.selection.ranges.map( ( { to } ) => to ) );

/**
 * Fold all
 *
 * @param {EditorState} state EditorState instance
 * @param {Tree} tree
 * @param {StateEffect[]} effects
 * @param {SyntaxNode} node
 * @param {number} end
 * @param {number} anchor
 * @param {Function} update
 * @param {boolean} [refOnly=false] If true, only fold `<ref>` tags
 * @return {number}
 * @private
 */
const traverse = ( state, tree, effects, node, end, anchor, update, refOnly ) => {
	while ( node && node.from <= end ) {
		const range = foldable( state, node, tree, refOnly );
		if ( range ) {
			effects.push( foldEffect.of( range ) );
			node = tree.resolve( range.to, 1 );
			// Update the anchor with the end of the last folded range
			anchor = update( anchor, range );
			continue;
		}
		node = node.nextSibling;
	}
	return anchor;
};

/**
 * Keymap for folding templates.
 *
 * @type {CodeMirrorKeyBinding[]}
 * @memberof module:CodeMirrorCodeFolding
 */
const foldKeymap = [
	{
		// Fold the code at the selection/cursor
		key: 'Ctrl-Shift-[',
		mac: 'Cmd-Alt-[',
		run( view ) {
			const { state } = view,
				tree = syntaxTree( state ),
				effects = [];
			let anchor = getAnchor( state );
			for ( const { from, to, empty } of state.selection.ranges ) {
				let node;
				if ( empty ) {
					// No selection, try both sides of the cursor position
					node = tree.resolve( from, -1 );
				}
				if ( !node || node.name === 'Document' ) {
					node = tree.resolve( from, 1 );
				}
				anchor = traverse( state, tree, effects, node, to, anchor, updateSelection );
			}
			return execute( view, effects, anchor );
		}
	},
	{
		// Unfold the code at the selection/cursor
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
				// Unfold the code and redraw the selections
				view.dispatch( { effects, selection } );
				return true;
			}
			return false;
		}
	},
	{
		// Fold all code in the document
		key: 'Ctrl-Alt-[',
		run( view ) {
			const { state } = view,
				tree = syntaxTree( state ),
				effects = [],
				anchor = traverse(
					state,
					tree,
					effects,
					tree.topNode.firstChild,
					Infinity,
					getAnchor( state ),
					updateAll
				);
			return execute( view, effects, anchor );
		}
	},
	{ key: 'Ctrl-Alt-]', run: unfoldAll },
	{
		// Fold all `<ref>` tags in the document
		key: 'Mod-Alt-,',
		run( view ) {
			const { state } = view,
				tree = syntaxTree( state ),
				effects = [],
				anchor = traverse(
					state,
					tree,
					effects,
					tree.topNode.firstChild,
					Infinity,
					getAnchor( state ),
					updateAll,
					true
				);
			return execute( view, effects, anchor );
		}
	}
];

/**
 * CodeMirror extension providing
 * [code folding](https://www.mediawiki.org/wiki/Help:Extension:CodeMirror#Code_folding)
 * for the MediaWiki mode. This automatically applied when using {@link CodeMirrorModeMediaWiki}.
 *
 * @module CodeMirrorCodeFolding
 * @type {Extension}
 */
const codeFoldingExtension = [
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
						// Unfold the code and redraw the selections
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
			if ( docChanged ) {
				return null;
			}
			return selection ? create( state ) : tooltip;
		},
		provide( f ) {
			return showTooltip.from( f );
		}
	} ),
	keymap.of( foldKeymap )
];

module.exports = { codeFoldingExtension };
