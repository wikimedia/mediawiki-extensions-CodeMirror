require( '../../ext.CodeMirror.data.js' );

if ( mw.config.get( 'extCodeMirrorConfig' ).useV6 ) {
	mw.loader.load( 'ext.CodeMirror.v6.visualEditor' );
} else {
	mw.loader.load( 'ext.CodeMirror.visualEditor' );
}
