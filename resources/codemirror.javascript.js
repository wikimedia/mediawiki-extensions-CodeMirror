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
			endColumn,
			fix,
			suggestions = []
		} ) => {
			const start = CodeMirrorWorker.pos( view, line, column );
			const diagnostic = {
				rule: ruleId,
				source: 'ESLint',
				message: message + ( ruleId ? ` (${ ruleId })` : '' ),
				severity: severity === 1 ? 'info' : 'error',
				from: start,
				to: endLine === undefined ?
					start + 1 :
					CodeMirrorWorker.pos( view, endLine, endColumn )
			};
			if ( fix || suggestions.length ) {
				diagnostic.actions = [
					...fix ? [ { name: 'fix', fix } ] : [],
					...suggestions.map( ( suggestion ) => ( { name: 'suggestion', fix: suggestion.fix } ) )
				].map( ( { name, fix: { range: [ from, to ], text } } ) => ( {
					name,
					apply( v ) {
						v.dispatch( { changes: { from, to, insert: text } } );
					}
				} ) );
			}
			return diagnostic;
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
