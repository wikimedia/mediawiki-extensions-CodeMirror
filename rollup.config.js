'use strict';

const nodeResolve = require( '@rollup/plugin-node-resolve' );
const alias = require( '@rollup/plugin-alias' );

module.exports = [
	// ext.CodeMirror.v6.lib
	{
		input: 'resources/codemirror.bundle.lib.js',
		output: {
			file: 'resources/lib/codemirror6.bundle.lib.js',
			format: 'cjs'
		},
		plugins: [
			nodeResolve()
		]
	},

	// ext.CodeMirror.v6.modes
	{
		input: 'resources/modes/codemirror.bundle.modes.js',
		output: {
			file: 'resources/lib/codemirror6.bundle.modes.js',
			format: 'cjs'
		},
		plugins: [
			alias( {
				entries: [
					{ find: '@codemirror/autocomplete', replacement: 'ext.CodeMirror.v6.lib' },
					{ find: '@codemirror/commands', replacement: 'ext.CodeMirror.v6.lib' },
					{ find: '@codemirror/language', replacement: 'ext.CodeMirror.v6.lib' },
					{ find: '@codemirror/lint', replacement: 'ext.CodeMirror.v6.lib' },
					{ find: '@codemirror/search', replacement: 'ext.CodeMirror.v6.lib' },
					{ find: '@codemirror/state', replacement: 'ext.CodeMirror.v6.lib' },
					{ find: '@codemirror/view', replacement: 'ext.CodeMirror.v6.lib' },
					{ find: '@lezer/highlight', replacement: 'ext.CodeMirror.v6.lib' }
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
	}
];
