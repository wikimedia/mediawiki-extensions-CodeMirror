const { jsonLanguage, jsonParseLinter } = require( '../lib/codemirror6.bundle.modes.js' );
const CodeMirrorMode = require( './codemirror.mode.js' );

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
