require( './ext.CodeMirror.data.js' );

if ( mw.config.get( 'extCodeMirrorConfig' ).useV6 ) {
	const deprecationFn = mw.log.makeDeprecated(
		'CodeMirror5-deprecation',
		'CodeMirror 5 has been deprecated in MediaWiki 1.43 and will be eventually removed. ' +
		'Please migrate to CodeMirror 6. See https://w.wiki/B3pr for more information.'
	);
	deprecationFn();
}

/**
 * Save CodeMirror enabled preference.
 *
 * @param {boolean} prefValue True, if CodeMirror should be enabled by default, otherwise false.
 */
function setCodeEditorPreference( prefValue ) {
	if ( !mw.user.isNamed() ) { // Skip it for unnamed users
		return;
	}
	new mw.Api().saveOption( 'usecodemirror', prefValue ? 1 : 0 );
	mw.user.options.set( 'usecodemirror', prefValue ? 1 : 0 );
}

module.exports = {
	setCodeEditorPreference: setCodeEditorPreference
};
