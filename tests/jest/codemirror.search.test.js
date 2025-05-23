/* eslint-disable-next-line n/no-missing-require */
const { EditorView, EditorState, SelectionRange } = require( 'ext.CodeMirror.v6.lib' );
const CodeMirror = require( '../../resources/codemirror.js' );
const CodeMirrorSearch = require( '../../resources/codemirror.search.js' );

const getCmWithSearchOpen = ( content = '' ) => {
	const form = document.createElement( 'form' );
	const textarea = document.createElement( 'textarea' );
	form.appendChild( textarea );
	const cm = new CodeMirror( textarea );
	cm.initialize();
	cm.textSelection.setContents( content );
	cm.view.contentDOM.dispatchEvent(
		new KeyboardEvent( 'keydown', { key: 'f', ctrlKey: true } )
	);
	return cm;
};

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

	it( 'should open the search panel with Ctrl+F', () => {
		const cm = getCmWithSearchOpen();
		expect( cm.view.dom.querySelector( '.cm-mw-panel--search-panel' ) ).toBeTruthy();
	} );

	it( 'should select all occurrences with the All button', () => {
		const cm = getCmWithSearchOpen( 'foo bar baz foo bar foo' );
		const panel = cm.view.dom.querySelector( '.cm-mw-panel--search-panel' );
		const input = panel.querySelector( '[name=search]' );
		input.value = 'foo';
		input.dispatchEvent( new Event( 'change' ) );
		panel.querySelector( '.cm-mw-panel--search__all' ).click();
		expect( cm.view.state.selection.ranges ).toHaveLength( 3 );
	} );

	it( 'should replace the first occurrence with the Replace button', () => {
		const cm = getCmWithSearchOpen( 'foo bar baz foo bar foo' );
		const panel = cm.view.dom.querySelector( '.cm-mw-panel--search-panel' );
		const searchInput = panel.querySelector( '[name=search]' );
		searchInput.value = 'foo';
		searchInput.dispatchEvent( new Event( 'change' ) );
		const replaceInput = panel.querySelector( '[name=replace]' );
		replaceInput.value = 'bar';
		replaceInput.dispatchEvent( new Event( 'change' ) );
		panel.querySelector( '.cm-mw-panel--search__replace' ).click();
		// Requires two clicks to first put focus on the editor.
		panel.querySelector( '.cm-mw-panel--search__replace' ).click();
		expect( cm.textSelection.getContents() ).toStrictEqual( 'bar bar baz foo bar foo' );
	} );

	it( 'should replace all occurrences with the Replace all button', () => {
		const cm = getCmWithSearchOpen( 'foo bar baz foo bar foo' );
		const panel = cm.view.dom.querySelector( '.cm-mw-panel--search-panel' );
		const searchInput = panel.querySelector( '[name=search]' );
		searchInput.value = 'foo';
		searchInput.dispatchEvent( new Event( 'change' ) );
		const replaceInput = panel.querySelector( '[name=replace]' );
		replaceInput.value = 'bar';
		replaceInput.dispatchEvent( new Event( 'change' ) );
		panel.querySelector( '.cm-mw-panel--search__replace-all' ).click();
		expect( cm.textSelection.getContents() ).toStrictEqual( 'bar bar baz bar bar bar' );
	} );

	it( 'should maintain the search query across different searches', () => {
		const cm = getCmWithSearchOpen( 'foo bar baz foo bar foo' );
		const panel = cm.view.dom.querySelector( '.cm-mw-panel--search-panel' );
		const searchInput = panel.querySelector( '[name=search]' );
		searchInput.value = 'foo';
		searchInput.dispatchEvent( new Event( 'change' ) );
		const replaceInput = panel.querySelector( '[name=replace]' );
		replaceInput.value = 'bar';
		replaceInput.dispatchEvent( new Event( 'change' ) );
		panel.querySelector( '.cm-mw-panel--search__replace' ).click();
		// Requires two clicks to first put focus on the editor.
		panel.querySelector( '.cm-mw-panel--search__replace' ).click();
		// Close the search panel.
		panel.querySelector( '.cm-mw-panel--search__done' ).click();
		expect( cm.textSelection.getContents() ).toBe( 'bar bar baz foo bar foo' );
		expect( cm.view.dom.querySelector( '.cm-mw-panel--search-panel' ) ).toBeFalsy();
		// Reopen the search panel.
		cm.view.contentDOM.dispatchEvent(
			new KeyboardEvent( 'keydown', { key: 'f', ctrlKey: true } )
		);
		const newPanel = cm.view.dom.querySelector( '.cm-mw-panel--search-panel' );
		expect( newPanel.querySelector( '[name=search]' ).value ).toBe( 'foo' );
		expect( newPanel.querySelector( '[name=replace]' ).value ).toBe( 'bar' );
		// Replace again.
		newPanel.querySelector( '.cm-mw-panel--search__replace' ).click();
		expect( cm.textSelection.getContents() ).toBe( 'bar bar baz bar bar foo' );
	} );

	it( 'should update the searchQuery when toggle buttons are used', () => {
		const cm = getCmWithSearchOpen( 'FOO bar baz foo bar foo' );
		const panel = cm.view.dom.querySelector( '.cm-mw-panel--search-panel' );
		const searchInput = panel.querySelector( '[name=search]' );
		searchInput.value = 'foo';
		searchInput.dispatchEvent( new Event( 'change' ) );
		expect( cm.search.searchQuery.caseSensitive ).toBeFalsy();
		cm.search.matchCaseButton.dispatchEvent( new Event( 'click' ) );
		expect( cm.search.searchQuery.caseSensitive ).toBeTruthy();
		expect( cm.search.searchQuery.regexp ).toBeFalsy();
		cm.search.regexpButton.dispatchEvent( new Event( 'click' ) );
		expect( cm.search.searchQuery.regexp ).toBeTruthy();
		expect( cm.search.searchQuery.wholeWord ).toBeFalsy();
		cm.search.wholeWordButton.dispatchEvent( new Event( 'click' ) );
		expect( cm.search.searchQuery.wholeWord ).toBeTruthy();
		cm.search.allButton.dispatchEvent( new Event( 'click' ) );
		expect( cm.view.state.selection.ranges ).toStrictEqual( [
			SelectionRange.fromJSON( { anchor: 12, head: 15 } ),
			SelectionRange.fromJSON( { anchor: 20, head: 23 } )
		] );
	} );
} );
