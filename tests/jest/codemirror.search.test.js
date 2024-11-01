/* eslint-disable-next-line n/no-missing-require */
const { EditorView, EditorState } = require( 'ext.CodeMirror.v6.lib' );
const CodeMirrorSearch = require( '../../resources/codemirror.search.js' );

describe( 'CodeMirrorSearch', () => {
	it( 'should provide an Extension getter and a Panel getter', () => {
		const cmSearch = new CodeMirrorSearch();
		cmSearch.view = new EditorView();
		expect( cmSearch.extension ).toBeInstanceOf( Array );
		expect( cmSearch.extension[ 0 ][ 0 ].constructor.name ).toStrictEqual( 'FacetProvider' );
		expect( cmSearch.panel ).toHaveProperty( 'dom' );
	} );

	it( 'should disable replacement fields if the textarea is read-only', () => {
		const cmSearch = new CodeMirrorSearch();
		cmSearch.view = new EditorView();
		// eslint-disable-next-line no-unused-expressions
		cmSearch.panel;

		cmSearch.view = new EditorView( {
			state: EditorState.create( {
				doc: '',
				extensions: [ EditorState.readOnly.of( true ) ]
			} )
		} );
		// eslint-disable-next-line no-unused-expressions
		cmSearch.panel;
		expect( cmSearch.replaceInput.disabled ).toBe( true );
	} );
} );
