( function ( mw ) {
	var config = mw.config.get( 'extCodeMirrorConfig' );

	if ( config.pluginModules && config.pluginModules.length > 0 ) {
		mw.loader.load( config.pluginModules );
	}
}( mediaWiki ) );
