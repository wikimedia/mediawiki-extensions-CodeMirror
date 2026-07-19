const { jsoncLanguage, jsoncLinter } = require( '../lib/codemirror.bundle.modes.js' );
const CodeMirrorMode = require( './codemirror.mode.js' );

/**
 * JSONC language support for CodeMirror.
 *
 * @example
 * const require = await mw.loader.using( [ 'ext.CodeMirror', 'ext.CodeMirror.modes' ] );
 * const CodeMirror = require( 'ext.CodeMirror' );
 * const { jsonc } = require( 'ext.CodeMirror.modes' );
 * const cm = new CodeMirror( myTextarea, jsonc() );
 * cm.initialize();
 * @extends CodeMirrorMode
 * @hideconstructor
 */
class CodeMirrorJsonc extends CodeMirrorMode {

	/** @inheritDoc */
	get language() {
		return jsoncLanguage;
	}

	/** @inheritDoc */
	get lintSource() {
		return jsoncLinter;
	}

	/** @inheritDoc */
	get hasWorker() {
		// JSONC linting is done in the main thread.
		return false;
	}
}

module.exports = CodeMirrorJsonc;
