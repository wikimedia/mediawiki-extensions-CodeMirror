const { LanguageSupport, syntaxTree } = require( 'ext.CodeMirror.v6.lib' );
const { cssLanguage, cssCompletionSource } = require( './lib/codemirror6.bundle.css.js' );
const CodeMirrorWorker = require( './codemirror.worker.js' );

const worker = new CodeMirrorWorker( 'css' );
const lintSource = ( view ) => worker.lint( view )
	.then( ( data ) => data
		.map( ( { text, severity, line, column, endLine, endColumn, rule } ) => ( {
			rule,
			source: 'Stylelint',
			message: text,
			severity: severity === 'error' ? 'error' : 'info',
			from: CodeMirrorWorker.pos( view, line, column ),
			to: endLine === undefined ?
				view.state.doc.line( line ).to :
				CodeMirrorWorker.pos( view, endLine, endColumn )
		} ) )
	);
lintSource.worker = worker;

module.exports = {
	css() {
		const extension = new LanguageSupport( cssLanguage, cssLanguage.data.of( {
			autocomplete( context ) {
				const { state, pos: p } = context,
					node = syntaxTree( state ).resolveInner( p, -1 ),
					result = cssCompletionSource( context );
				if ( result && node.name === 'ValueName' ) {
					const options = [ { label: 'revert', type: 'keyword' }, ...result.options ];
					let { prevSibling } = node;
					while ( prevSibling && prevSibling.name !== 'PropertyName' ) {
						( { prevSibling } = prevSibling );
					}
					if ( prevSibling ) {
						for ( let i = 0; i < options.length; i++ ) {
							const option = options[ i ];
							if ( CSS.supports(
								state.sliceDoc( prevSibling.from, node.from ) + option.label
							) ) {
								options.splice( i, 1, Object.assign( {}, option, { boost: 50 } ) );
							}
						}
					}
					result.options = options;
				}
				return result;
			}
		} ) );
		extension.lintSource = lintSource;
		return extension;
	}
};

if ( mw.config.get( 'cmDebug' ) ) {
	window.cssWorker = worker;
}
