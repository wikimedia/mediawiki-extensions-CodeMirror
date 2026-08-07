/* eslint-disable-next-line n/no-missing-require */
const { EditorState, ensureSyntaxTree } = require( 'ext.CodeMirror.lib' );
/* eslint-disable-next-line n/no-missing-require */
const CodeMirror = require( 'ext.CodeMirror' );
const { html } = require( '../../../resources/modes/codemirror.mode.exporter.js' );

describe( 'CodeMirrorHtml', () => {
	it( 'is named after the mode', () => {
		expect( html().language.name ).toBe( 'html' );
	} );

	it( 'has no linting', () => {
		const mode = html();
		expect( mode.lintSource ).toBeUndefined();
		expect( mode.worker ).toBeUndefined();
	} );

	it( 'sets the mode on the CodeMirror instance', () => {
		const cm = new CodeMirror( document.createElement( 'textarea' ), html() );
		expect( cm.mode ).toBe( 'html' );
	} );

	// The HTML parser reaches ext.CodeMirror.modes only as a dependency of
	// lang-vue, so this fails loudly if lang-vue is ever dropped.
	it( 'highlights JavaScript and CSS inside script and style tags', () => {
		const doc = '<div class="x"><script>let a = 1;</script><style>a { color: red; }</style></div>';
		const state = EditorState.create( { doc, extensions: [ html().extension ] } );
		const nodeNames = [];
		ensureSyntaxTree( state, doc.length ).iterate( { enter: ( node ) => {
			nodeNames.push( node.name );
		} } );
		expect( nodeNames ).toContain( 'Script' );
		expect( nodeNames ).toContain( 'VariableDefinition' );
		expect( nodeNames ).toContain( 'StyleSheet' );
		expect( nodeNames ).toContain( 'Declaration' );
	} );
} );
