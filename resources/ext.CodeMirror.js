$( document ).ready( function () {
	var myCodeMirror = CodeMirror.fromTextArea(document.getElementById("wpTextbox1"), {
		mode: "text/mediawiki",
		styleActiveLine: true,
		lineNumbers: true,
		lineWrapping: true,
		indentUnit: 4,
		indentWithTabs: true
		//matchBrackets: true,
		//autoCloseBrackets: true
	});
} );
