const { Extension, Language, LanguageSupport, LintSource } = require( 'ext.CodeMirror.v6.lib' );
const CodeMirrorWorker = require( '../workers/codemirror.worker.js' );

/**
 * Abstract interface for CodeMirror modes.
 *
 * Clients can unpack individual modes from the `ext.CodeMirror.v6.modes` module.
 * Each mode is exposed as a method with the same name as the mode in the form of a
 * {@link LanguageSupport}-like instance that is consumable by {@link CodeMirror}.
 *
 * @example
 * const CodeMirror = require( 'ext.CodeMirror.v6' );
 * const { javascript } = require( 'ext.CodeMirror.v6.modes' );
 * const cm = new CodeMirror( myTextArea, javascript() );
 * cm.initialize();
 * @implements LanguageSupport
 */
class CodeMirrorMode {

	constructor( name ) {
		/**
		 * The name of the mode.
		 *
		 * @type {string}
		 */
		this.name = name;

		/**
		 * The web worker for the mode, if any.
		 *
		 * @type {CodeMirrorWorker|undefined}
		 */
		this.worker = this.hasWorker ? new CodeMirrorWorker( this.name ) : undefined;
	}

	/**
	 * The complete set of extensions for this mode, including the language and any
	 * supporting extensions.
	 *
	 * @return {Extension}
	 */
	get extension() {
		return [ this.language, this.support ];
	}

	/**
	 * The language object.
	 *
	 * @type {Language}
	 */
	get language() {
		throw new Error( 'Not implemented' );
	}

	/**
	 * The function to lint the code in the editor.
	 *
	 * @type {LintSource|undefined}
	 */
	get lintSource() {
		return undefined;
	}

	/**
	 * Whether the mode should load a web worker.
	 *
	 * @return {boolean}
	 */
	get hasWorker() {
		return !!this.lintSource;
	}

	/**
	 * Supporting extensions.
	 *
	 * @type {Extension}
	 */
	get support() {
		return [];
	}
}

module.exports = CodeMirrorMode;
