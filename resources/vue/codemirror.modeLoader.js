/**
 * @module ext.CodeMirror.VueComponent.modeLoader
 * @description
 * Maps each mode to the ResourceLoader module that provides it, and loads it.
 *
 * This is an implementation detail of
 * {@link module:ext.CodeMirror.VueComponent ext.CodeMirror.VueComponent}
 * and is not intended for external use.
 * @internal
 * @ignore
 */

const extendedModes = [
	'angular',
	'cpp',
	'elixir',
	'go',
	'handlebars',
	'java',
	'julia',
	'less',
	'liquid',
	'markdown',
	'mustache',
	'nix',
	'php',
	'pkl',
	'python',
	'r',
	'rust',
	'sass',
	'sparql',
	'sql',
	'wast',
	'xml',
	'yaml'
];

/**
 * The ResourceLoader module that provides each mode.
 *
 * @type {Object<string,string>}
 */
const modeModules = {
	abusefilter: 'ext.CodeMirror.abusefilter',
	css: 'ext.CodeMirror.modes',
	html: 'ext.CodeMirror.modes',
	javascript: 'ext.CodeMirror.modes',
	json: 'ext.CodeMirror.modes',
	jsonc: 'ext.CodeMirror.modes',
	lua: 'ext.CodeMirror.modes',
	mediawiki: 'ext.CodeMirror.mode.mediawiki',
	vue: 'ext.CodeMirror.modes'
};

for ( const mode of extendedModes ) {
	modeModules[ mode ] = 'ext.CodeMirror.modes.extended';
}

/**
 * Load the ResourceLoader module for the given mode and build its language support.
 *
 * @param {string} mode
 * @param {Object} [config] Passed to the mode. Only the `mediawiki` mode uses this.
 * @return {Promise<LanguageSupport>}
 * @throws {Error} If the mode is unknown, or its module doesn't provide it.
 */
async function loadLanguageSupport( mode, config = {} ) {
	const moduleName = modeModules[ mode ];
	if ( !moduleName ) {
		throw new Error( `[CodeMirror] Unknown mode "${ mode }"` );
	}

	await mw.loader.using( [ 'ext.CodeMirror', moduleName ] );

	// eslint-disable-next-line security/detect-non-literal-require
	const modeModule = require( moduleName );
	// The mediawiki and abusefilter modules export a single factory,
	// the others export one per mode.
	const factory = typeof modeModule === 'function' ? modeModule : modeModule[ mode ];
	if ( typeof factory !== 'function' ) {
		throw new Error( `[CodeMirror] Mode "${ mode }" is not provided by ${ moduleName }` );
	}

	// Modes other than mediawiki take no configuration and ignore the argument.
	return factory( config );
}

module.exports = { modeModules, loadLanguageSupport };
