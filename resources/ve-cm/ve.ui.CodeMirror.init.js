require( '../ext.CodeMirror.data.js' );

const urlParams = new URLSearchParams( window.location.search );

if ( mw.config.get( 'extCodeMirrorConfig' ).useV6 || urlParams.get( 'cm6enable' ) ) {
	mw.loader.load( 'ext.CodeMirror.v6.visualEditor' );
} else {
	mw.loader.load( 'ext.CodeMirror.visualEditor' );
}
