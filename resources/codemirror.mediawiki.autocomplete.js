const {
	Extension,
	autocompletion,
	acceptCompletion,
	keymap
} = require( 'ext.CodeMirror.v6.lib' );

/**
 * Keymap for autocompletion.
 *
 * @type {CodeMirrorKeyBinding}
 * @memberof module:CodeMirrorAutocomplete
 */
const autocompleteKeymap = {
	key: 'Tab',
	aliases: [ 'Enter' ],
	run: acceptCompletion
};

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
	keymap.of( [ autocompleteKeymap ] )
];

module.exports = {
	autocompleteExtension,
	autocompleteKeymap
};
