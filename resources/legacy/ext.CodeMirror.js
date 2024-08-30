require( './ext.CodeMirror.data.js' );

if ( mw.config.get( 'extCodeMirrorConfig' ).useV6 ) {
	const deprecationFn = mw.log.makeDeprecated(
		'CodeMirror5-deprecation',
		'CodeMirror 5 has been deprecated in MediaWiki 1.43 and will be removed in 1.44. ' +
		'Please migrate to CodeMirror 6. See https://w.wiki/B3pr for more information.'
	);
	deprecationFn();
}

/**
 * Log usage of CodeMirror.
 *
 * @param {Object} data
 */
function logUsage( data ) {
	/* eslint-disable camelcase */
	const event = Object.assign( {
		session_token: mw.user.sessionId(),
		user_id: mw.user.getId()
	}, data );
	const editCountBucket = mw.config.get( 'wgUserEditCountBucket' );
	if ( editCountBucket !== null ) {
		event.user_edit_count_bucket = editCountBucket;
	}
	/* eslint-enable camelcase */
	mw.track( 'event.CodeMirrorUsage', event );
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
	logUsage: logUsage,
	setCodeEditorPreference: setCodeEditorPreference
};
