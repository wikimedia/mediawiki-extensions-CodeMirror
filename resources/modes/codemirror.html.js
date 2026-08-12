const { colorPicker, html, htmlLanguage } = require( '../lib/codemirror.bundle.modes.js' );
const CodeMirrorMode = require( './codemirror.mode.js' );

/**
 * HTML language support for CodeMirror.
 *
 * Includes JavaScript and CSS support for `<script>` and `<style>` tags.
 *
 * @example
 * const require = await mw.loader.using( [ 'ext.CodeMirror', 'ext.CodeMirror.modes' ] );
 * const CodeMirror = require( 'ext.CodeMirror' );
 * const { html } = require( 'ext.CodeMirror.modes' );
 * const cm = new CodeMirror( myTextarea, html() );
 * cm.initialize();
 * @extends CodeMirrorMode
 * @hideconstructor
 */
class CodeMirrorHtml extends CodeMirrorMode {
	/** @inheritDoc */
	get language() {
		return htmlLanguage;
	}

	/** @inheritDoc */
	get support() {
		return [
			html().support,
			colorPicker
		];
	}

	/** @inheritDoc */
	get hasWorker() {
		return false;
	}
}

module.exports = CodeMirrorHtml;
