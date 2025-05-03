import esbuild from "rollup-plugin-esbuild";

function generateRollup(output) {
	const plugins = [
		esbuild({
			minify: true,
			target: "es2016",
		}),
	];

	return {
		context: "window",
		input: "resources/lib/eslint-linter-browserify/linter.js",
		output,
		plugins,
	};
}

export default [
	generateRollup({
		file: "resources/lib/eslint-linter-browserify/linter.min.js",
		format: "cjs",
		exports: "named",
	})
];
