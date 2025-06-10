/* global eslint */
const onmessage = require( '../common.js' );
require( '@bhsd/eslint-browserify/bundle/eslint-es8.min.js' );

const linter = new eslint.Linter();
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

let customConfig = config;

const setConfig = ( newConfig ) => {
	customConfig = Object.assign( {}, newConfig, {
		parserOptions: Object.assign( {}, config.parserOptions, newConfig.parserOptions ),
		env: Object.assign( {}, config.env, newConfig.env ),
		globals: Object.assign( {}, config.globals, newConfig.globals ),
		rules: Object.assign( {}, config.rules, newConfig.rules )
	} );
};
const getConfig = () => customConfig;
const lint = ( code ) => linter.verify( code, customConfig );

onmessage( setConfig, getConfig, lint );
