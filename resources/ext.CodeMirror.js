/*global CodeMirror, mw*/
jQuery( document ).ready( function ( $ ) {
	var textbox1 = $( '#wpTextbox1' );
	var codeMirror = CodeMirror.fromTextArea( textbox1[0], {
			mwextFunctionSynonyms: mw.config.get( 'extCodeMirrorFunctionSynonyms' ),
			mwextTags: mw.config.get( 'extCodeMirrorTags' ),
			styleActiveLine: true,
			//lineNumbers: true,
			lineWrapping: true,
			//indentUnit: 4,
			//indentWithTabs: true
			//matchBrackets: true,
			//autoCloseBrackets: true,
			mode: 'text/mediawiki'
		} );
	codeMirror.setSize( null, textbox1.height() );
} );
