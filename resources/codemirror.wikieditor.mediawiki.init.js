const CodeMirrorWikiEditor = require( 'ext.CodeMirror.v6.WikiEditor' );
const mediaWikiLang = require( 'ext.CodeMirror.v6.mode.mediawiki' );

// TODO: remove URL feature flag once bidi isolation is more stable.
const urlParams = new URLSearchParams( window.location.search );

if ( mw.loader.getState( 'ext.wikiEditor' ) ) {
	mw.hook( 'wikiEditor.toolbarReady' ).add( ( $textarea ) => {
		const mwLang = mediaWikiLang( {
			bidiIsolation: urlParams.get( 'cm6bidi' )
		} );
		const cmWE = new CodeMirrorWikiEditor( $textarea, mwLang );
		cmWE.addCodeMirrorToWikiEditor();
	} );
}
