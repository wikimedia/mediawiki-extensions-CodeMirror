const { LRLanguage, LanguageSupport } = require( 'ext.CodeMirror.lib' );
const bundle = require( '../lib/codemirror.bundle.modes.extended.js' );

/**
 * @module ext.CodeMirror.modes.extended
 * @description
 * This module provides syntax highlighting for languages that are not MediaWiki
 * content models. Each mode is exposed as a method that returns a
 * {@link LanguageSupport} instance that can be used with the {@link CodeMirror}
 * constructor.
 *
 * These languages have no linting or autocomplete beyond what the upstream
 * packages provide. For MediaWiki content models such as JavaScript, CSS, JSON,
 * Lua, Vue and HTML, use {@link module:ext.CodeMirror.modes ext.CodeMirror.modes}.
 * For wikitext, use
 * {@link module:ext.CodeMirror.mode.mediawiki ext.CodeMirror.mode.mediawiki}.
 *
 * Everything in this module is downloaded together, so prefer
 * {@link module:ext.CodeMirror.modes ext.CodeMirror.modes} where it has the
 * language you need.
 * @example
 * const require = await mw.loader.using( [ 'ext.CodeMirror', 'ext.CodeMirror.modes.extended' ] );
 * const CodeMirror = require( 'ext.CodeMirror' );
 * const { python } = require( 'ext.CodeMirror.modes.extended' );
 * const cm = new CodeMirror( myTextarea, python() );
 * cm.initialize();
 */

/**
 * Modes provided by upstream packages as a ready-made factory.
 *
 * @type {string[]}
 * @private
 */
const upstreamModes = [
	'angular',
	'cpp',
	'elixir',
	'go',
	'java',
	'julia',
	'less',
	'liquid',
	'markdown',
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
 * Wrap an upstream factory so the language is named after the mode.
 *
 * CodeMirror takes its mode from `language.name`, which some upstream packages
 * leave empty or spell differently than we do.
 *
 * @param {string} name
 * @return {Function}
 * @private
 */
function upstreamMode( name ) {
	return ( config ) => {
		const support = bundle[ name ]( config );
		if ( support.language.name === name ) {
			return support;
		}
		return new LanguageSupport(
			support.language.configure( {}, name ),
			support.support
		);
	};
}

/**
 * @method angular
 * @return {LanguageSupport} LanguageSupport for the Angular mode.
 */
/**
 * @method cpp
 * @return {LanguageSupport} LanguageSupport for the C++ mode.
 */
/**
 * @method elixir
 * @return {LanguageSupport} LanguageSupport for the Elixir mode.
 */
/**
 * @method go
 * @return {LanguageSupport} LanguageSupport for the Go mode.
 */
/**
 * @method java
 * @return {LanguageSupport} LanguageSupport for the Java mode.
 */
/**
 * @method julia
 * @return {LanguageSupport} LanguageSupport for the Julia mode.
 */
/**
 * @method less
 * @return {LanguageSupport} LanguageSupport for the Less mode.
 */
/**
 * @method liquid
 * @return {LanguageSupport} LanguageSupport for the Liquid mode.
 */
/**
 * @method markdown
 * @return {LanguageSupport} LanguageSupport for the Markdown mode.
 */
/**
 * @method nix
 * @return {LanguageSupport} LanguageSupport for the Nix mode.
 */
/**
 * @method php
 * @return {LanguageSupport} LanguageSupport for the PHP mode.
 */
/**
 * @method pkl
 * @return {LanguageSupport} LanguageSupport for the PKL mode.
 */
/**
 * @method python
 * @return {LanguageSupport} LanguageSupport for the Python mode.
 */
/**
 * @method r
 * @return {LanguageSupport} LanguageSupport for the R mode.
 */
/**
 * @method rust
 * @return {LanguageSupport} LanguageSupport for the Rust mode.
 */
/**
 * @method sass
 * @return {LanguageSupport} LanguageSupport for the Sass mode.
 */
/**
 * @method sparql
 * @return {LanguageSupport} LanguageSupport for the SPARQL mode.
 */
/**
 * @method sql
 * @return {LanguageSupport} LanguageSupport for the SQL mode.
 */
/**
 * @method wast
 * @return {LanguageSupport} LanguageSupport for the WAST mode.
 */
/**
 * @method xml
 * @return {LanguageSupport} LanguageSupport for the XML mode.
 */
/**
 * @method yaml
 * @return {LanguageSupport} LanguageSupport for the YAML mode.
 */

module.exports = {};

for ( const name of upstreamModes ) {
	module.exports[ name ] = upstreamMode( name );
}

/**
 * @method handlebars
 * @return {LanguageSupport} LanguageSupport for the Handlebars mode.
 */
module.exports.handlebars = () => new LanguageSupport(
	bundle.handlebarsLanguage.configure( {}, 'handlebars' )
);

/**
 * @method mustache
 * @return {LanguageSupport} LanguageSupport for the Mustache mode.
 */
module.exports.mustache = () => new LanguageSupport(
	LRLanguage.define( { name: 'mustache', parser: bundle.mustacheParser } )
);
