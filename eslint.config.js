'use strict';

const { defineConfig, globalIgnores } = require( 'eslint/config' );
const globals = require( 'globals' );
const wikimedia = require( 'eslint-config-wikimedia/flat' );
const esX = require( 'eslint-plugin-es-x' );

// Web workers, with the es-x rules that differ for each worker
const workers = {
	css: {
		'es-x/no-array-prototype-findlast-findlastindex': 'off',
		'es-x/no-array-prototype-at': 'off',
		'es-x/no-string-prototype-at': 'off'
	},
	javascript: {
		'es-x/no-object-hasown': 'off',
		'es-x/no-array-prototype-at': 'off',
		'es-x/no-string-prototype-at': 'off'
	},
	lua: {
		'es-x/no-resizable-and-growable-arraybuffers': 'off'
	},
	mediawiki: {}
};

// Directories with their own config, which other configs don't apply to.
// These were directories with `"root": true` in .eslintrc.json.
const rootDirs = {
	resources: [ 'resources/**' ],
	workers: Object.keys( workers ).map( ( name ) => `resources/workers/${ name }/**` ),
	selenium: [ 'tests/selenium/**' ],
	docs: [ 'docs-src/**' ]
};

module.exports = defineConfig( [
	globalIgnores( [
		// Upstream code
		'resources/lib/*',
		'resources/lib/*/',

		// Build
		'vendor/',
		'docs/',
		'coverage/',

		// Language files written automatically by TranslateWiki
		'**/i18n/**/*.json',
		'!**/i18n/**/en.json',
		'!**/i18n/**/qqq.json'
	] ),

	// Gruntfile.js, etc.
	{
		ignores: Object.values( rootDirs ).flat(),
		extends: [ wikimedia( 'server' ) ]
	},

	// Jest tests
	{
		files: [ 'tests/jest/**' ],
		extends: [ wikimedia( 'jest', 'jquery', 'mediawiki' ) ],
		languageOptions: {
			sourceType: 'module',
			globals: {
				// From `env: { browser: true }`
				...globals.browser,
				mockMwConfigGet: 'writable',
				mockUserOptionsGet: 'writable'
			}
		},
		rules: {
			'jest/expect-expect': [ 'error', {
				assertFunctionNames: [ 'expect', 'test' ]
			} ],
			'jest/valid-title': [ 'error', {
				ignoreTypeOfDescribeName: true,
				ignoreTypeOfTestName: true
			} ]
		}
	},

	// Code which runs in MediaWiki
	{
		files: rootDirs.resources,
		ignores: rootDirs.workers,
		extends: [ wikimedia( 'client', 'jquery', 'mediawiki' ) ],
		languageOptions: {
			sourceType: 'module',
			globals: {
				Tree: 'readonly',
				ve: 'readonly'
			}
		},
		settings: {
			jsdoc: {
				preferredTypes: {
					CodeMirror: 'CodeMirror',
					'CodeMirror.applyExtension': 'CodeMirror.applyExtension',
					'CodeMirror.container': 'CodeMirror.container',
					'CodeMirror.ext.CodeMirror.destroy': 'CodeMirror.ext.CodeMirror.destroy',
					'CodeMirror.ext.CodeMirror.initialize': 'CodeMirror.ext.CodeMirror.initialize',
					'CodeMirror.ext.CodeMirror.input': 'CodeMirror.ext.CodeMirror.input',
					'CodeMirror.ext.CodeMirror.preferences.apply': 'CodeMirror.ext.CodeMirror.preferences.apply',
					'CodeMirror.ext.CodeMirror.preferences.ready': 'CodeMirror.ext.CodeMirror.preferences.ready',
					'CodeMirror.ext.CodeMirror.ready': 'CodeMirror.ext.CodeMirror.ready',
					'CodeMirror.ext.CodeMirror.toggle': 'CodeMirror.ext.CodeMirror.toggle',
					'CodeMirror.extensionRegistry': 'CodeMirror.extensionRegistry',
					'CodeMirror.initialize': 'CodeMirror.initialize',
					'CodeMirror.textarea': 'CodeMirror.textarea',
					'CodeMirror.loadLanguageSupport': 'CodeMirror.loadLanguageSupport',
					'CodeMirror.view': 'CodeMirror.view',
					CodeMirrorChild: 'CodeMirrorChild',
					CodeMirrorExtensionRegistry: 'CodeMirrorExtensionRegistry',
					CodeMirrorKeyBinding: 'CodeMirrorKeyBinding',
					CodeMirrorKeymap: 'CodeMirrorKeymap',
					CodeMirrorMediaWiki: 'CodeMirrorMediaWiki',
					CodeMirrorMode: 'CodeMirrorMode',
					CodeMirrorPreferences: 'CodeMirrorPreferences',
					'CodeMirrorPreferences.extension': 'CodeMirrorPreferences.extension',
					CodeMirrorSortLines: 'CodeMirrorSortLines',
					CodeMirrorTextSelection: 'CodeMirrorTextSelection',
					CodeMirrorThemes: 'CodeMirrorThemes',
					CodeMirrorVisualEditor: 'CodeMirrorVisualEditor',
					Editor: 'Editor',
					FormSpecifier: 'FormSpecifier',
					HighlightStyle: 'HighlightStyle',
					Hook: 'Hook',
					LanguageSupport: 'LanguageSupport',
					PrefValue: 'PrefValue'
				}
			}
		}
	},

	// Web workers, and their built files (worker.min.js), which must be ES2019
	...Object.entries( workers ).map( ( [ name, rules ] ) => ( {
		files: [ `resources/workers/${ name }/**` ],
		extends: [ esX.configs[ 'flat/restrict-to-es2019' ] ],
		languageOptions: {
			ecmaVersion: 2019,
			sourceType: 'script'
		},
		rules,
		settings: {
			'es-x': { aggressive: true }
		}
	} ) ),
	{
		files: Object.keys( workers ).map( ( name ) => `resources/workers/${ name }/worker.js` ),
		extends: [ wikimedia( 'client', 'jquery', 'mediawiki' ) ]
	},
	{
		files: rootDirs.workers,
		languageOptions: {
			// From `env: { worker: true }`
			globals: globals.worker
		}
	},

	// Selenium tests
	{
		files: rootDirs.selenium,
		extends: [ wikimedia( 'selenium' ) ],
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: 'module',
			globals: {
				mw: 'readonly',
				document: 'readonly'
			}
		},
		rules: {
			'wdio/no-pause': 'warn'
		}
	},

	// Build of the wikitext style reference, and the code it runs in the browser
	{
		files: rootDirs.docs,
		extends: [ wikimedia( 'server' ) ],
		rules: {
			'n/no-missing-require': [ 'error', { allowModules: [ 'ext.CodeMirror.lib' ] } ]
		},
		settings: {
			jsdoc: {
				preferredTypes: {
					CodeMirrorMediaWiki: 'CodeMirrorMediaWiki',
					Highlight: 'Highlight'
				}
			}
		}
	},
	{
		files: [ 'docs-src/demo.js', 'docs-src/stubs.js' ],
		extends: [ wikimedia( 'client' ) ],
		languageOptions: {
			sourceType: 'module'
		}
	}
] );
