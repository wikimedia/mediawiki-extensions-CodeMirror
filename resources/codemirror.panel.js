const { EditorView, Extension, Panel } = require( 'ext.CodeMirror.v6.lib' );
const CodeMirrorCodex = require( './codemirror.codex.js' );

/**
 * Abstract class for a panel that can be used with CodeMirror.
 * This class provides methods to create CSS-only Codex components.
 *
 * @see https://codemirror.net/docs/ref/#h_panels
 * @todo Move HTML generation to Mustache templates.
 * @abstract
 */
class CodeMirrorPanel extends CodeMirrorCodex {
	/**
	 * @constructor
	 */
	constructor() {
		super();
		/** @type {EditorView} */
		this.view = undefined;
	}

	/**
	 * Get the panel and any associated keymaps as an Extension.
	 * For use only during CodeMirror initialization.
	 *
	 * @abstract
	 * @type {Extension}
	 * @internal
	 */
	// eslint-disable-next-line getter-return
	get extension() {}

	/**
	 * Get the Panel object.
	 *
	 * @abstract
	 * @type {Panel}
	 */
	// eslint-disable-next-line getter-return
	get panel() {}
}

module.exports = CodeMirrorPanel;
