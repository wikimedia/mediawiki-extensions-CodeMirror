require( '../ext.CodeMirror.data.js' );

// This is hacky: mw.hook ensures that new handlers would be fired immediately if they are
// added after the event. We are using this feature to load the actual module via a callback
// when this module is loaded by VE.
//
// TODO: Change the PluginModules in extension.json when fully migrated to v6 and drop this.
mw.hook( 've.loadModules' ).add( ( addPlugin ) => {
	const urlParams = new URLSearchParams( window.location.search );

	// VE would wait for plugin callbacks to resolve before initialisation.
	if ( mw.config.get( 'extCodeMirrorConfig' ).useV6 || urlParams.get( 'cm6enable' ) ) {
		addPlugin( () => mw.loader.using( 'ext.CodeMirror.v6.visualEditor' ) );
	} else {
		addPlugin( () => mw.loader.using( 'ext.CodeMirror.visualEditor' ) );
	}
} );
