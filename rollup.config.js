'use strict';

const nodeResolve = require( '@rollup/plugin-node-resolve' );
const copy = require( 'rollup-plugin-copy' );
const babel = require( '@rollup/plugin-babel' );
const terser = require( '@rollup/plugin-terser' );

/**
 * Mapping of import paths to ResourceLoader module names.
 * See usage in 'plugins' below for explanation.
 * @type {Object}
 */
const importAliases = {
	'./vendor.js': 'ext.CodeMirror.v6.lib',
	'./codemirror.js': 'ext.CodeMirror.v6',
	'./codemirror.mode.mediawiki.js': 'ext.CodeMirror.v6.mode.mediawiki'
};

module.exports = [
	{
		// One entry for each ResourceLoader module that we want to ship.
		input: [
			'src/codemirror.js',
			'src/codemirror.mode.mediawiki.js',
			'src/codemirror.wikieditor.mediawiki.js'
		],

		output: {
			entryFileNames: '[name].js',
			dir: 'resources/dist',

			// Magically makes our ECMAScript Modules work with the
			// CommonJS-style preferred by ResourceLoader. Ta-da!
			format: 'cjs',

			// Remove hash from chunked file name. We only want vendor code to be
			// chunked, and we need the file name to be stable for use by ResourceLoader.
			chunkFileNames: () => '[name].js',

			// Bundle all vendor code into a single file called 'vendor.js'.
			// This includes the Babel helpers because they are used by all our modules.
			manualChunks: ( id ) => {
				if ( id.includes( 'node_modules' ) || id.includes( 'rollupPluginBabelHelpers' ) ) {
					return 'vendor';
				}
			}
		},

		plugins: [
			nodeResolve(),

			// HACK: Rollup doesn't know about ResourceLoader and attempts to `require`
			// modules using a relative path, when they need to match the RL module name.
			// Here we do string replacements to fix that. This is nasty and brittle, but
			// otherwise we couldn't offer standalone CodeMirror functionality via RL,
			// which is necessary for usage in on-wiki scripts and gadgets (T214989).
			copy( {
				targets: [ {
					src: 'resources/dist/*',
					dest: 'resources/dist/',
					transform: ( contents ) => {
						Object.keys( importAliases ).forEach( ( alias ) => {
							contents = contents.toString().replace(
								`require("${ alias }")`,
								`require("${ importAliases[ alias ] }")`
							);
						} );
						return contents;
					}
				} ],
				hook: 'writeBundle'
			} ),

			babel( { babelHelpers: 'bundled' } ),

			terser()
		],

		onwarn: ( warning, warn ) => {
			// Suppress "not exported" warnings. We import those for IDE support not for the build.
			if ( warning.code === 'MISSING_EXPORT' ) {
				return;
			}
			warn( warning );
		}
	}
];
