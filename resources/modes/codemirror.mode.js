const {
	defaultHighlightStyle,
	oneDarkHighlightStyle,
	tags,
	Config,
	EditorView,
	Extension,
	Language,
	LanguageSupport,
	LintSource
} = require( 'ext.CodeMirror.lib' );
const CodeMirrorWorker = require( '../workers/codemirror.worker.js' );

/* eslint-disable jsdoc/valid-types */
/**
 * Abstract interface for CodeMirror modes.
 *
 * Clients can unpack individual modes from the
 * {@link module:ext.CodeMirror.modes ext.CodeMirror.modes} module.
 * Each mode is exposed as a method with the same name as the mode in the form of a
 * {@link LanguageSupport}-like instance that is consumable by {@link CodeMirror}.
 *
 * @example
 * const CodeMirror = require( 'ext.CodeMirror' );
 * const { javascript } = require( 'ext.CodeMirror.modes' );
 * const cm = new CodeMirror( myTextArea, javascript() );
 * cm.initialize();
 * @implements LanguageSupport
 */
class CodeMirrorMode {
	/* eslint-enable jsdoc/valid-types */

	/**
	 * @param {string} name
	 * @internal
	 */
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
	 * The function to lint the code in the editor using a MediaWiki API.
	 *
	 * @type {LintSource|undefined}
	 */
	get lintApi() {
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
	 * The configuration for bracket matching.
	 *
	 * @type {Config|undefined}
	 */
	get bracketMatchingConfig() {
		return undefined;
	}

	/**
	 * Supporting extensions.
	 *
	 * @type {Extension}
	 */
	get support() {
		return [];
	}

	/**
	 * This extension adds extra highlighting styles for JavaScript/Lua.
	 *
	 * @type {Extension}
	 * @protected
	 * @internal
	 */
	get theme() {
		const getColor = ( style, target ) => style.specs.find(
			( { tag } ) => tag === target || Array.isArray( tag ) && tag.includes( target )
		).color;
		const doctag = tags.labelName;
		const doctagType = tags.typeName;
		const doctagVar = tags.special( tags.variableName );

		return EditorView.baseTheme( {
			'&light .cm-doctag > *': {
				color: getColor( defaultHighlightStyle, doctag )
			},
			'&dark .cm-doctag > *': {
				color: getColor( oneDarkHighlightStyle, doctag )
			},
			'&light .cm-doctag-type > *': {
				color: getColor( defaultHighlightStyle, doctagType )
			},
			'&dark .cm-doctag-type > *': {
				color: getColor( oneDarkHighlightStyle, doctagType )
			},
			'&light .cm-doctag-var > *': {
				color: getColor( defaultHighlightStyle, doctagVar )
			},
			'&dark .cm-doctag-var > *': {
				color: getColor( oneDarkHighlightStyle, doctagVar )
			}
		} );
	}
}

module.exports = CodeMirrorMode;
