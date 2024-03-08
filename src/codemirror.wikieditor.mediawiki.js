import CodeMirrorWikiEditor from './codemirror.wikieditor';
import { mediaWikiLang } from './codemirror.mode.mediawiki';
import { templateFoldingExtension } from './codemirror.templateFolding';

if ( mw.loader.getState( 'ext.wikiEditor' ) ) {
	mw.hook( 'wikiEditor.toolbarReady' ).add( ( $textarea ) => {
		const cmWE = new CodeMirrorWikiEditor( $textarea, [
			mediaWikiLang(),
			templateFoldingExtension
		] );
		cmWE.addCodeMirrorToWikiEditor();
	} );
}
