const { vue, vueLanguage } = require( '../lib/codemirror6.bundle.modes.js' );
const CodeMirrorMode = require( './codemirror.mode.js' );

class CodeMirrorVue extends CodeMirrorMode {
	/** @inheritDoc */
	get language() {
		return vueLanguage;
	}

	/** @inheritDoc */
	get support() {
		return vue().support;
	}

	/** @inheritDoc */
	get lintSource() {
		// TODO: Implement linting for Vue files.
		return undefined;
	}

	/** @inheritDoc */
	get hasWorker() {
		return false;
	}
}

module.exports = CodeMirrorVue;
