const { EditorView, syntaxTree } = require( 'ext.CodeMirror.v6.lib' );
const { getTag, searchTag } = require( './codemirror.mediawiki.matchTag.js' );
const mwModeConfig = require( './codemirror.mediawiki.config.js' );

module.exports = EditorView.inputHandler.of( ( view, from, to, text, insertTransaction ) => {
	if ( view.composing || view.state.readOnly || from !== to || text !== '>' ) {
		return false;
	}
	const base = insertTransaction(),
		{ state } = base,
		tree = syntaxTree( state ),
		closeTags = state.changeByRange( ( range ) => {
			const didType = state.sliceDoc( range.from - 1, range.to ) === text,
				{ head } = range,
				after = tree.resolveInner( head, -1 ),
				types = after.name.split( '_' );
			if ( didType && (
				types.includes( mwModeConfig.tags.extTagBracket ) ||
				types.includes( mwModeConfig.tags.htmlTagBracket )
			) && head === after.from + 1 ) {
				const tag = getTag( state, after.prevSibling );
				if ( tag && !tag.closing && !tag.selfClosing && !searchTag( state, tag ) ) {
					return {
						range,
						changes: { from: head, to: head, insert: `</${ tag.name }>` }
					};
				}
			}
			return { range };
		} );
	if ( closeTags.changes.empty ) {
		return false;
	}
	view.dispatch( [
		base,
		state.update( closeTags, { userEvent: 'input.complete', scrollIntoView: true } )
	] );
	return true;
} );
