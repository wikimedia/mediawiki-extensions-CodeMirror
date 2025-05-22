const { LanguageSupport, syntaxTree } = require( 'ext.CodeMirror.v6.lib' );
const { cssLanguage, cssCompletionSource } = require( './lib/codemirror6.bundle.css.js' );

let worker;

const pos = ( doc, line, column ) => {
	const cmLine = doc.line( line );
	return Math.min( cmLine.from + column - 1, cmLine.to );
};

const getFeedback = ( command, doc ) => new Promise( ( resolve ) => {
	if ( !worker ) {
		worker = new Worker( `${
			mw.config.get( 'wgExtensionAssetsPath' )
		}/CodeMirror/resources/workers/css/worker.min.js` );
	}
	const raw = doc && doc.toString();
	const listener = ( { data: [ cmd, diagnostics, resRaw ] } ) => {
		if ( command === cmd && raw === resRaw ) {
			worker.removeEventListener( 'message', listener );
			resolve( diagnostics );
		}
	};
	worker.addEventListener( 'message', listener );
	worker.postMessage( [ command, raw ] );
} );

const lintSource = ( { state: { doc } } ) => getFeedback( 'lint', doc )
	.then( ( data ) => data
		.map( ( { text, severity, line, column, endLine, endColumn } ) => ( {
			source: 'Stylelint',
			message: text,
			severity: severity === 'error' ? 'error' : 'info',
			from: pos( doc, line, column ),
			to: endLine === undefined ?
				doc.line( line ).to :
				pos( doc, endLine, endColumn )
		} ) )
	);
lintSource.setConfig = ( config ) => worker.postMessage( [ 'setConfig', config ] );
lintSource.getConfig = () => getFeedback( 'getConfig' );

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
	window.cssWorker = getFeedback;
}
