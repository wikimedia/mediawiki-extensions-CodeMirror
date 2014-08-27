/*global CodeMirror*/
jQuery( document ).ready( function ( $ ) {
	var textbox1 = $( '#wpTextbox1' );
	var codeMirror = CodeMirror.fromTextArea( textbox1[0], {
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
