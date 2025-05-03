import commonjs from "@rollup/plugin-commonjs";
import {nodeResolve} from "@rollup/plugin-node-resolve";
import json from "@rollup/plugin-json";
import nodePolyfills from 'rollup-plugin-polyfill-node';

function generateRollup(output) {
	const plugins = [
		commonjs({
			ignoreGlobal: true,
			requireReturnsDefault: "preferred",
			strictRequires: "auto",
		}),
		json(),
		nodePolyfills(),
		nodeResolve({
			preferBuiltins: false
		}),
	];

	return {
		context: "window",
		input: "resources/lib/eslint-linter-browserify/index.js",
		output: {
			intro: "if (!global) { var global = globalThis || window; }",
			...output,
		},
		plugins,
	};
}

export default [
	generateRollup({
		file: "resources/eslint-linter-browserify.js",
		format: "cjs",
		exports: "named",
	})
];
