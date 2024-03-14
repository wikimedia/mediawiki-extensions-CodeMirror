import CodeMirrorWikiEditor from './codemirror.wikieditor';
import mediaWikiLang from './codemirror.mode.mediawiki';

if ( mw.loader.getState( 'ext.wikiEditor' ) ) {
	mw.hook( 'wikiEditor.toolbarReady' ).add( ( $textarea ) => {
		const cmWE = new CodeMirrorWikiEditor(
			$textarea,
			mediaWikiLang( { bidiIsolation: $textarea.attr( 'dir' ) === 'rtl' } )
		);
		cmWE.addCodeMirrorToWikiEditor();
	} );
}
