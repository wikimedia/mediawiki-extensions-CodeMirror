const {
	javascript,
	javascriptLanguage,
	scopeCompletionSource
} = require( './lib/codemirror6.bundle.javascript.js' );
const CodeMirrorWorker = require( './codemirror.worker.js' );

const worker = new CodeMirrorWorker( 'javascript' );
const lintSource = ( view ) => worker.lint( view )
	.then( ( data ) => data
		.map( ( {
			ruleId,
			message,
			severity,
			line,
			column,
			endLine,
			endColumn
		} ) => {
			const start = CodeMirrorWorker.pos( view, line, column );
			return {
				rule: ruleId,
				source: 'ESLint',
				message: message + ( ruleId ? ` (${ ruleId })` : '' ),
				severity: severity === 1 ? 'info' : 'error',
				from: start,
				to: endLine === undefined ?
					start + 1 :
					CodeMirrorWorker.pos( view, endLine, endColumn )
			};
		} )
	);
lintSource.worker = worker;

module.exports = {
	javascript() {
		const extension = [
			javascript(),
			javascriptLanguage.data.of( { autocomplete: scopeCompletionSource( window ) } )
		];
		extension.lintSource = lintSource;
		return extension;
	}
};

if ( mw.config.get( 'cmDebug' ) ) {
	window.javascriptWorker = worker;
}
