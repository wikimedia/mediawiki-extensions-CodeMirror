'use strict';

const nodeResolve = require( '@rollup/plugin-node-resolve' );

module.exports = [
	{
		input: 'resources/codemirror.bundle.js',

		output: {
			file: 'resources/lib/codemirror6.bundle.dist.js',
			format: 'cjs'
		},

		plugins: [
			nodeResolve()
		]
	}
];
