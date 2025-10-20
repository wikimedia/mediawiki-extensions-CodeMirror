const { vue, vueLanguage } = require( '../lib/codemirror6.bundle.modes.js' );
const CodeMirrorMode = require( './codemirror.mode.js' );

/**
 * Vue language support for CodeMirror.
 *
 * @example
 * const require = await mw.loader.using( [ 'ext.CodeMirror.v6', 'ext.CodeMirror.v6.modes' ] );
 * const CodeMirror = require( 'ext.CodeMirror.v6' );
 * const { vue } = require( 'ext.CodeMirror.v6.modes' );
 * const cm = new CodeMirror( myTextarea, vue() );
 * cm.initialize();
 * @extends CodeMirrorMode
 * @hideconstructor
 */
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
