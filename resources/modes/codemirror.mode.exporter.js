module.exports = {};

/**
 * @module ext.CodeMirror.v6.modes
 * @description
 * This module provides syntax highlighting for JavaScript, JSON, CSS, Lua, and Vue in CodeMirror.
 * Each mode is exposed as a method that returns a {@link LanguageSupport}-compatible instance
 * that can be used with the {@link CodeMirror} constructor.
 *
 * For MediaWiki wikitext syntax highlighting, use
 * {@link module:ext.CodeMirror.v6.mode.mediawiki ext.CodeMirror.v6.mode.mediawiki}.
 * @example
 * const require = await mw.loader.using( [ 'ext.CodeMirror.v6', 'ext.CodeMirror.v6.modes' ] );
 * const CodeMirror = require( 'ext.CodeMirror.v6' );
 * const { javascript, css } = require( 'ext.CodeMirror.v6.modes' );
 * const cmJs = new CodeMirror( myJsTextarea, javascript() );
 * cmJs.initialize();
 * const cmCss = new CodeMirror( myCssTextarea, css() );
 * cmCss.initialize();
 */

/* eslint-disable jsdoc/no-undefined-types */
/**
 * @method javascript
 * @return {CodeMirrorJavaScript|LanguageSupport} LanguageSupport for the JavaScript mode.
 */
/**
 * @method json
 * @return {CodeMirrorJson|LanguageSupport} LanguageSupport for the JSON mode.
 */
/**
 * @method css
 * @return {CodeMirrorCss|LanguageSupport} LanguageSupport for the CSS mode.
 */
/**
 * @method lua
 * @return {CodeMirrorLua|LanguageSupport} LanguageSupport for the Lua mode.
 */
/**
 * @method vue
 * @return {CodeMirrorVue|LanguageSupport} LanguageSupport for the Vue mode.
 */
/* eslint-enable jsdoc/no-undefined-types */

for ( const mode of [ 'javascript', 'json', 'css', 'lua', 'vue' ] ) {
	module.exports[ mode ] = function () {
		// eslint-disable-next-line security/detect-non-literal-require
		const ModeClass = require( `./codemirror.${ mode }.js` );
		return new ModeClass( mode );
	};
}
