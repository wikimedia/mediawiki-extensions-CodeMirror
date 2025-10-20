const { jsonLanguage, jsonParseLinter } = require( '../lib/codemirror6.bundle.modes.js' );
const CodeMirrorMode = require( './codemirror.mode.js' );

/**
 * JSON language support for CodeMirror.
 *
 * @example
 * const require = await mw.loader.using( [ 'ext.CodeMirror.v6', 'ext.CodeMirror.v6.modes' ] );
 * const CodeMirror = require( 'ext.CodeMirror.v6' );
 * const { json } = require( 'ext.CodeMirror.v6.modes' );
 * const cm = new CodeMirror( myTextarea, json() );
 * cm.initialize();
 * @extends CodeMirrorMode
 * @hideconstructor
 */
class CodeMirrorJson extends CodeMirrorMode {

	/** @inheritDoc */
	get language() {
		return jsonLanguage;
	}

	/** @inheritDoc */
	get lintSource() {
		return jsonParseLinter();
	}

	/** @inheritDoc */
	get hasWorker() {
		// JSON linting is done in the main thread.
		return false;
	}
}

module.exports = CodeMirrorJson;
