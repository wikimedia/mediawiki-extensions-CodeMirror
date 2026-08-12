'use strict';

const nodeResolve = require( '@rollup/plugin-node-resolve' );
const alias = require( '@rollup/plugin-alias' );

// Aliases match by import name, so a nested copy at a different version is never bundled.

module.exports = [
	// ext.CodeMirror.lib
	{
		input: 'resources/codemirror.bundle.lib.js',
		output: {
			file: 'resources/lib/codemirror.bundle.lib.js',
			format: 'cjs'
		},
		plugins: [
			nodeResolve()
		]
	},

	// ext.CodeMirror.modes
	{
		input: 'resources/modes/codemirror.bundle.modes.js',
		output: {
			file: 'resources/lib/codemirror.bundle.modes.js',
			format: 'cjs'
		},
		plugins: [
			alias( {
				entries: [
					{ find: '@codemirror/autocomplete', replacement: 'ext.CodeMirror.lib' },
					{ find: '@codemirror/commands', replacement: 'ext.CodeMirror.lib' },
					{ find: '@codemirror/language', replacement: 'ext.CodeMirror.lib' },
					{ find: '@codemirror/lint', replacement: 'ext.CodeMirror.lib' },
					{ find: '@codemirror/search', replacement: 'ext.CodeMirror.lib' },
					{ find: '@codemirror/state', replacement: 'ext.CodeMirror.lib' },
					{ find: '@codemirror/view', replacement: 'ext.CodeMirror.lib' },
					{ find: '@lezer/highlight', replacement: 'ext.CodeMirror.lib' }
				]
			} ),
			nodeResolve( {
				resolveOnly: [
					'@bhsd/browser',
					'@bhsd/codemirror-css-color-picker',
					'@bhsd/common',
					'@bhsd/lezer-json',
					'@codemirror/lang-css',
					'@codemirror/lang-html',
					'@codemirror/lang-javascript',
					'@codemirror/lang-vue',
					'@codemirror/legacy-modes',
					'@lezer/common',
					'@lezer/css',
					'@lezer/html',
					'@lezer/javascript',
					'@lezer/json',
					'@lezer/lr'
				]
			} )
		]
	},

	// ext.CodeMirror.modes.extended
	{
		input: 'resources/modes/codemirror.bundle.modes.extended.js',
		output: {
			file: 'resources/lib/codemirror.bundle.modes.extended.js',
			format: 'cjs'
		},
		plugins: [
			alias( {
				entries: [
					{ find: '@codemirror/autocomplete', replacement: 'ext.CodeMirror.lib' },
					{ find: '@codemirror/commands', replacement: 'ext.CodeMirror.lib' },
					{ find: '@codemirror/language', replacement: 'ext.CodeMirror.lib' },
					{ find: '@codemirror/lint', replacement: 'ext.CodeMirror.lib' },
					{ find: '@codemirror/search', replacement: 'ext.CodeMirror.lib' },
					{ find: '@codemirror/state', replacement: 'ext.CodeMirror.lib' },
					{ find: '@codemirror/view', replacement: 'ext.CodeMirror.lib' },
					{ find: '@lezer/highlight', replacement: 'ext.CodeMirror.lib' }
				]
			} ),
			nodeResolve( {
				resolveOnly: [
					'@codemirror/lang-angular',
					'@codemirror/lang-cpp',
					'@codemirror/lang-css',
					'@codemirror/lang-go',
					'@codemirror/lang-html',
					'@codemirror/lang-java',
					'@codemirror/lang-javascript',
					'@codemirror/lang-less',
					'@codemirror/lang-liquid',
					'@codemirror/lang-markdown',
					'@codemirror/lang-php',
					'@codemirror/lang-python',
					'@codemirror/lang-rust',
					'@codemirror/lang-sass',
					'@codemirror/lang-sql',
					'@codemirror/lang-wast',
					'@codemirror/lang-xml',
					'@codemirror/lang-yaml',
					'@grumptech/lezer-mustache',
					'@lezer/common',
					'@lezer/cpp',
					'@lezer/css',
					'@lezer/go',
					'@lezer/html',
					'@lezer/java',
					'@lezer/javascript',
					'@lezer/lr',
					'@lezer/markdown',
					'@lezer/php',
					'@lezer/python',
					'@lezer/rust',
					'@lezer/sass',
					'@lezer/xml',
					'@lezer/yaml',
					'@plutojl/lang-julia',
					'@plutojl/lezer-julia',
					'@replit/codemirror-lang-nix',
					'@xiechao/codemirror-lang-handlebars',
					'codemirror-lang-elixir',
					'codemirror-lang-pkl',
					'codemirror-lang-r',
					'codemirror-lang-sparql',
					'lezer-elixir',
					'lezer-r'
				]
			} )
		]
	},

	// ext.CodeMirror.abusefilter
	{
		input: 'resources/modes/codemirror.bundle.abusefilter.js',
		output: {
			file: 'resources/lib/codemirror.bundle.abusefilter.js',
			format: 'cjs'
		},
		plugins: [
			alias( {
				entries: [
					{ find: '@codemirror/autocomplete', replacement: 'ext.CodeMirror.lib' },
					{ find: '@codemirror/commands', replacement: 'ext.CodeMirror.lib' },
					{ find: '@codemirror/language', replacement: 'ext.CodeMirror.lib' },
					{ find: '@codemirror/lint', replacement: 'ext.CodeMirror.lib' },
					{ find: '@codemirror/search', replacement: 'ext.CodeMirror.lib' },
					{ find: '@codemirror/state', replacement: 'ext.CodeMirror.lib' },
					{ find: '@codemirror/view', replacement: 'ext.CodeMirror.lib' },
					{ find: '@lezer/highlight', replacement: 'ext.CodeMirror.lib' }
				]
			} ),
			nodeResolve( {
				resolveOnly: [
					'@bhsd/lezer-abusefilter',
					'@lezer/common',
					'@lezer/lr'
				]
			} )
		]
	}
];
