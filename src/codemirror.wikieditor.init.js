import CodeMirrorWikiEditor from './codemirror.wikieditor';

if ( mw.loader.getState( 'ext.wikiEditor' ) ) {
	mw.hook( 'wikiEditor.toolbarReady' ).add( ( $textarea ) => {
		const cmWE = new CodeMirrorWikiEditor( $textarea );
		cmWE.addCodeMirrorToWikiEditor();
	} );
}
