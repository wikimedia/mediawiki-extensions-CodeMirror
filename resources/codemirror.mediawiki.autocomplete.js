const {
	autocompletion,
	acceptCompletion,
	keymap
} = require( 'ext.CodeMirror.v6.lib' );

/**
 * CodeMirror extension providing
 * autocompletion
 * for the MediaWiki mode. This automatically applied when using {@link CodeMirrorModeMediaWiki}.
 *
 * @module CodeMirrorAutocomplete
 * @type {Extension}
 */
const autocompleteExtension = [
	autocompletion( { defaultKeymap: true } ),
	keymap.of( [ { key: 'Tab', run: acceptCompletion } ] )
];

module.exports = autocompleteExtension;
