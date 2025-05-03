const {
	javascript,
	javascriptLanguage,
	scopeCompletionSource
} = require( './lib/codemirror6.bundle.javascript.js' );
const { Linter } = require( './lib/eslint-linter-browserify/linter.min.js' );

const pos = ( doc, line, column ) => doc.line( line ).from + column - 1;

const lintSource = ( { state: { doc } } ) => {
	const linter = new Linter();
	const config = {
		parserOptions: {
			ecmaVersion: 15
		},
		env: {
			browser: true,
			es2024: true
		},
		globals: {
			mw: 'readonly',
			mediaWiki: 'readonly',
			$: 'readonly',
			jQuery: 'readonly',
			OO: 'readonly',
			addOnloadHook: 'readonly',
			importScriptURI: 'readonly',
			importScript: 'readonly',
			importStylesheet: 'readonly',
			importStylesheetURI: 'readonly',
			RLQ: 'readonly',
			require: 'readonly',
			module: 'readonly'
		},
		rules: {}
	};
	for ( const [ name, { meta } ] of linter.getRules() ) {
		if ( meta && meta.docs && meta.docs.recommended ) {
			config.rules[ name ] = 1;
		}
	}
	return linter.verify( doc.toString(), config )
		.map( ( {
			ruleId,
			message,
			severity,
			line,
			column,
			endLine,
			endColumn
		} ) => {
			const start = pos( doc, line, column );
			return {
				source: 'ESLint',
				message: message + ( ruleId ? ` (${ ruleId })` : '' ),
				severity: severity === 1 ? 'info' : 'error',
				from: start,
				to: endLine === undefined ? start + 1 : pos( doc, endLine, endColumn )
			};
		} );
};

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
