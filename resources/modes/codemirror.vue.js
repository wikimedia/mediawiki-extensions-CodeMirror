const { syntaxTree } = require( 'ext.CodeMirror.lib' );
const { javascriptLanguage, vue, vueLanguage } = require( '../lib/codemirror.bundle.modes.js' );
const CodeMirrorMode = require( './codemirror.mode.js' );

/**
 * Vue language support for CodeMirror.
 *
 * @example
 * const require = await mw.loader.using( [ 'ext.CodeMirror', 'ext.CodeMirror.modes' ] );
 * const CodeMirror = require( 'ext.CodeMirror' );
 * const { vue } = require( 'ext.CodeMirror.modes' );
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

	/** @inheritDoc */
	get bracketMatchingConfig() {
		return {
			exclude( state, pos ) {
				return javascriptLanguage.isActiveAt( state, pos, 0 ) &&
					syntaxTree( state ).resolveInner( pos, 0 ).name === 'RegExp';
			}
		};
	}
}

module.exports = CodeMirrorVue;
