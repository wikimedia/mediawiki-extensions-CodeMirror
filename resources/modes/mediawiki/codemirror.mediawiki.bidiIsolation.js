const {
	Decoration,
	DecorationSet,
	Direction,
	EditorView,
	PluginSpec,
	Prec,
	RangeSet,
	RangeSetBuilder,
	ViewPlugin,
	ViewUpdate,
	syntaxTree
} = require( 'ext.CodeMirror.v6.lib' );
const mwModeConfig = require( './codemirror.mediawiki.config.js' );

/**
 * @type {Decoration}
 * @private
 */
const isolate = Decoration.mark( {
	class: 'cm-bidi-isolate',
	bidiIsolate: Direction.LTR
} );

/**
 * @param {EditorView} view
 * @return {RangeSet}
 * @private
 */
function computeIsolates( view ) {
	const set = new RangeSetBuilder();

	if ( view.editorAttrs.dir === 'rtl' ) {
		for ( const { from, to } of view.visibleRanges ) {
			let startPos = null;
			syntaxTree( view.state ).iterate( {
				from,
				to,
				enter( node ) {
					// Determine if this is a bracket node (start or end of a tag).
					const isBracket = node.name.split( '_' )
						.some( ( tag ) => [
							mwModeConfig.tags.htmlTagBracket,
							mwModeConfig.tags.extTagBracket
						].includes( tag ) );

					if ( startPos === null && isBracket ) {
						// If we find a bracket node, we keep track of the start position.
						startPos = node.from;
					} else if ( isBracket ) {
						// When we find the closing bracket, add the isolate.
						set.add( startPos, node.to, isolate );
						startPos = null;
					}
				}
			} );
		}
	}

	return set.finish();
}

/**
 * @private
 */
class CodeMirrorBidiIsolation {
	/**
	 * @constructor
	 * @param {EditorView} view The editor view.
	 */
	constructor( view ) {
		/** @type {DecorationSet} */
		this.isolates = computeIsolates( view );
		/** @type {Tree} */
		this.tree = syntaxTree( view.state );
		/** @type {Direction} */
		this.dir = view.textDirection;
	}

	/**
	 * @param {ViewUpdate} update
	 */
	update( update ) {
		if ( update.docChanged || update.viewportChanged ||
			syntaxTree( update.state ) !== this.tree ||
			update.view.textDirection !== this.dir
		) {
			this.isolates = computeIsolates( update.view );
			this.tree = syntaxTree( update.state );
		}
	}
}

/**
 * @type {PluginSpec}
 * @private
 */
const bidiIsolationSpec = {
	provide: ( plugin ) => {
		/**
		 * @param {EditorView} view
		 * @return {DecorationSet}
		 */
		const access = ( view ) => view.plugin( plugin ) ?
			( view.plugin( plugin ).isolates || Decoration.none ) :
			Decoration.none;

		// Use the lowest precedence to ensure that other decorations
		// don't break up the isolating decorations.
		return Prec.lowest( [
			EditorView.decorations.of( access ),
			EditorView.bidiIsolatedRanges.of( access )
		] );
	}
};

/**
 * Bidirectional isolation plugin for CodeMirror for use on RTL pages.
 * This ensures HTML and MediaWiki tags are always displayed left-to-right.
 *
 * Use this plugin by passing in `bidiIsolation: true` when instantiating
 * a [CodeMirrorModeMediaWiki]{@link CodeMirrorModeMediaWiki} object.
 *
 * @module CodeMirrorBidiIsolation
 * @see https://codemirror.net/examples/bidi/
 */
module.exports = ViewPlugin.fromClass( CodeMirrorBidiIsolation, bidiIsolationSpec );
