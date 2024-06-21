const CodeMirrorWikiEditor = require( 'ext.CodeMirror.v6.WikiEditor' );
const mediaWikiLang = require( 'ext.CodeMirror.v6.mode.mediawiki' );

// TODO: remove URL feature flag once bidi isolation is more stable.
const urlParams = new URLSearchParams( window.location.search );

if ( mw.loader.getState( 'ext.wikiEditor' ) ) {
	mw.hook( 'wikiEditor.toolbarReady' ).add( ( $textarea ) => {
		const cmWE = new CodeMirrorWikiEditor(
			$textarea,
			mediaWikiLang( {
				bidiIsolation: $textarea.attr( 'dir' ) === 'rtl' && urlParams.get( 'cm6bidi' )
			} )
		);
		cmWE.addCodeMirrorToWikiEditor();
	} );
}
