'use strict';

const nodeResolve = require( '@rollup/plugin-node-resolve' );
const alias = require( '@rollup/plugin-alias' );

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
					'@codemirror/lang-html',
					'@codemirror/lang-javascript',
					'@codemirror/lang-css',
					'@codemirror/lang-json',
					'@codemirror/lang-vue',
					'@codemirror/legacy-modes',
					'@lezer/html',
					'@lezer/javascript',
					'@lezer/css',
					'@lezer/json',
					'@lezer/common',
					'@lezer/lr'
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
