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
	// ext.CodeMirror.v6.mode.javascript
	// ext.CodeMirror.v6.mode.json
	// ext.CodeMirror.v6.mode.css
	// ext.CodeMirror.v6.mode.lua
	...[ 'javascript', 'json', 'css', 'lua' ].map(
		( mode ) => ( {
			input: mode === 'lua' ?
				'node_modules/@codemirror/legacy-modes/mode/lua.js' :
				`node_modules/@codemirror/lang-${ mode }/dist/index.js`,
			output: {
				file: `resources/lib/codemirror6.bundle.${ mode }.js`,
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
					resolveOnly: mode === 'lua' ?
						[ '@codemirror/legacy-modes' ] :
						[
							`@codemirror/lang-${ mode }`,
							`@lezer/${ mode }`,
							// Most HTTP requests are for action=edit on wikitext, which doesn't
							// need the full Lezer parser. At scale, it's more efficient to
							// duplicate these for each language module than to include them in
							// ext.CodeMirror.v6.lib.
							'@lezer/common',
							'@lezer/lr'
						]
				} )
			]
		} )
	)
];
