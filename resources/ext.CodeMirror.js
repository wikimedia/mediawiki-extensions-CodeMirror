/*global CodeMirror*/
jQuery( document ).ready( function ( $ ) {
	CodeMirror.fromTextArea( $( '#wpTextbox1' )[0], {
			styleActiveLine: true,
			//lineNumbers: true,
			lineWrapping: true,
			//indentUnit: 4,
			//indentWithTabs: true
			//matchBrackets: true,
			//autoCloseBrackets: true,
			mode: 'text/mediawiki'
		} );
} );
