const CodeMirror = require( '../../resources/codemirror.js' );
const { mediawiki } = require( '../../resources/modes/mediawiki/codemirror.mediawiki.js' );
const { javascript, vue } = require( '../../resources/modes/codemirror.mode.exporter.js' );

const selector = '.cm-matchingBracket, .cm-nonmatchingBracket';

describe( 'CodeMirrorBracketMatching for StreamLanguage', () => {
	let cm;

	beforeEach( () => {
		const textarea = document.createElement( 'textarea' );
		document.body.appendChild( textarea );
		cm = new CodeMirror( textarea, mediawiki() );
		cm.initialize();
		cm.textSelection.setContents( ' {{ Foo | 1 = {{ Bar }} }} Baz [' );
	} );

	it( 'should highlight nothing', () => {
		cm.textSelection.setSelection( { start: 0 } );
		expect( cm.view.contentDOM.querySelectorAll( selector ).length ).toEqual( 0 );
		cm.textSelection.setSelection( { start: 27 } );
		expect( cm.view.contentDOM.querySelectorAll( selector ).length ).toEqual( 0 );
	} );

	it( 'should highlight matched brackets', () => {
		cm.textSelection.setSelection( { start: 26 } );
		expect( cm.view.contentDOM.querySelectorAll( '.cm-matchingBracket' ).length ).toEqual( 2 );
		cm.textSelection.setSelection( { start: 14 } );
		expect( cm.view.contentDOM.querySelectorAll( '.cm-matchingBracket' ).length ).toEqual( 2 );
	} );

	it( 'should highlight unmatched brackets', () => {
		cm.textSelection.setSelection( { start: 31 } );
		expect( cm.view.contentDOM.querySelectorAll( '.cm-nonmatchingBracket' ).length ).toEqual( 1 );
		cm.textSelection.setSelection( { start: 32 } );
		expect( cm.view.contentDOM.querySelectorAll( '.cm-nonmatchingBracket' ).length ).toEqual( 1 );
	} );

	it( 'should highlight surrounding brackets', () => {
		cm.textSelection.setSelection( { start: 11 } );
		expect( cm.view.contentDOM.querySelectorAll( '.cm-matchingBracket' ).length ).toEqual( 2 );
		cm.textSelection.setSelection( { start: 18 } );
		expect( cm.view.contentDOM.querySelectorAll( '.cm-matchingBracket' ).length ).toEqual( 2 );
	} );

	it( 'should highlight CJK full-width brackets', () => {
		cm.textSelection.setContents( '【】' );
		cm.textSelection.setSelection( { start: 0 } );
		expect( cm.view.contentDOM.querySelectorAll( '.cm-matchingBracket' ).length ).toEqual( 2 );
		cm.textSelection.setSelection( { start: 2 } );
		expect( cm.view.contentDOM.querySelectorAll( '.cm-matchingBracket' ).length ).toEqual( 2 );
	} );

	it( 'should update the extension with a new config', () => {
		cm.textSelection.setContents( '<div>[http://example.org]' );
		// Should not highlight angle brackets.
		cm.textSelection.setSelection( { start: 2 } );
		expect( cm.view.contentDOM.querySelectorAll( selector ).length ).toEqual( 0 );
		// Should highlight square brackets.
		cm.textSelection.setSelection( { start: 6 } );
		expect( cm.view.contentDOM.querySelectorAll( '.cm-matchingBracket' ).length ).toEqual( 2 );

		cm.bracketMatchingConfig = { brackets: '<>' };
		// Should highlight angle brackets.
		cm.textSelection.setSelection( { start: 2 } );
		expect( cm.view.contentDOM.querySelectorAll( '.cm-matchingBracket' ).length ).toEqual( 2 );
		// Should not highlight square brackets.
		cm.textSelection.setSelection( { start: 6 } );
		expect( cm.view.contentDOM.querySelectorAll( selector ).length ).toEqual( 0 );
	} );
} );

describe( 'CodeMirrorBracketMatching for LRLanguage', () => {
	let cm;

	beforeEach( () => {
		const textarea = document.createElement( 'textarea' );
		document.body.appendChild( textarea );
		cm = new CodeMirror( textarea, javascript() );
		cm.initialize();
		cm.textSelection.setContents( 'if ( true ) { a = f( "{" ); }' );
	} );

	it( 'should highlight nothing', () => {
		cm.textSelection.setSelection( { start: 0 } );
		expect( cm.view.contentDOM.querySelectorAll( selector ).length ).toEqual( 0 );
	} );

	it( 'should highlight matched brackets', () => {
		cm.textSelection.setSelection( { start: 3 } );
		expect( cm.view.contentDOM.querySelectorAll( '.cm-matchingBracket' ).length ).toEqual( 2 );
		cm.textSelection.setSelection( { start: 27 } );
		expect( cm.view.contentDOM.querySelectorAll( '.cm-matchingBracket' ).length ).toEqual( 2 );
	} );

	it( 'should highlight unmatched brackets', () => {
		cm.textSelection.setSelection( { start: 22 } );
		expect( cm.view.contentDOM.querySelectorAll( '.cm-nonmatchingBracket' ).length ).toEqual( 1 );
		cm.textSelection.setSelection( { start: 23 } );
		expect( cm.view.contentDOM.querySelectorAll( '.cm-nonmatchingBracket' ).length ).toEqual( 1 );
	} );

	it( 'should highlight surrounding brackets', () => {
		cm.textSelection.setSelection( { start: 15 } );
		expect( cm.view.contentDOM.querySelectorAll( '.cm-matchingBracket' ).length ).toEqual( 2 );
		cm.textSelection.setSelection( { start: 21 } );
		expect( cm.view.contentDOM.querySelectorAll( '.cm-matchingBracket' ).length ).toEqual( 2 );
	} );

	it( 'should not highlight CJK full-width brackets', () => {
		cm.textSelection.setContents( '"【】"' );
		cm.textSelection.setSelection( { start: 1 } );
		expect( cm.view.contentDOM.querySelectorAll( selector ).length ).toEqual( 0 );
		cm.textSelection.setSelection( { start: 3 } );
		expect( cm.view.contentDOM.querySelectorAll( selector ).length ).toEqual( 0 );
	} );

	it( 'should ignore RegExp literal', () => {
		cm.textSelection.setContents( '/[x]/' );
		cm.textSelection.setSelection( { start: 1 } );
		expect( cm.view.contentDOM.querySelectorAll( selector ).length ).toEqual( 0 );
		cm.textSelection.setSelection( { start: 4 } );
		expect( cm.view.contentDOM.querySelectorAll( selector ).length ).toEqual( 0 );

		cm.textSelection.setContents( '( /[x]/ )' );
		cm.textSelection.setSelection( { start: 3 } );
		expect( cm.view.contentDOM.querySelectorAll( '.cm-matchingBracket' ).length ).toEqual( 2 );
		cm.textSelection.setSelection( { start: 6 } );
		expect( cm.view.contentDOM.querySelectorAll( '.cm-matchingBracket' ).length ).toEqual( 2 );
	} );

	it( 'should update the extension with a new config', () => {
		cm.textSelection.setContents( 'let a = "string", b = [], c = `[]`;' );
		// Should not highlight double quotes.
		cm.textSelection.setSelection( { start: 8 } );
		expect( cm.view.contentDOM.querySelectorAll( selector ).length ).toEqual( 0 );
		// Should highlight square brackets.
		cm.textSelection.setSelection( { start: 22 } );
		expect( cm.view.contentDOM.querySelectorAll( '.cm-matchingBracket' ).length ).toEqual( 2 );
		cm.textSelection.setSelection( { start: 32 } );
		expect( cm.view.contentDOM.querySelectorAll( '.cm-matchingBracket' ).length ).toEqual( 2 );

		cm.bracketMatchingConfig = { brackets: '""' };
		// Should highlight double quotes.
		// But the matching fails because of identical opening and closing characters.
		cm.textSelection.setSelection( { start: 8 } );
		expect( cm.view.contentDOM.querySelectorAll( '.cm-nonmatchingBracket' ).length ).toEqual( 1 );
		// Should not highlight plain-text square brackets.
		cm.textSelection.setSelection( { start: 32 } );
		expect( cm.view.contentDOM.querySelectorAll( selector ).length ).toEqual( 0 );
		// Cannot disable highlighting of syntax brackets.
		cm.textSelection.setSelection( { start: 22 } );
		expect( cm.view.contentDOM.querySelectorAll( '.cm-matchingBracket' ).length ).toEqual( 2 );
	} );
} );

describe( 'CodeMirrorBracketMatching for nested JavaScript', () => {
	let cm;

	beforeEach( () => {
		const textarea = document.createElement( 'textarea' );
		document.body.appendChild( textarea );
		cm = new CodeMirror( textarea, vue() );
		cm.initialize();
	} );

	it( 'should ignore RegExp literal', () => {
		cm.textSelection.setContents( '<script>/[x]/</script>' );
		cm.textSelection.setSelection( { start: 9 } );
		expect( cm.view.contentDOM.querySelectorAll( selector ).length ).toEqual( 0 );
		cm.textSelection.setSelection( { start: 12 } );
		expect( cm.view.contentDOM.querySelectorAll( selector ).length ).toEqual( 0 );

		cm.textSelection.setContents( '<script>( /[x]/ )</script>' );
		cm.textSelection.setSelection( { start: 11 } );
		expect( cm.view.contentDOM.querySelectorAll( '.cm-matchingBracket' ).length ).toEqual( 2 );
		cm.textSelection.setSelection( { start: 14 } );
		expect( cm.view.contentDOM.querySelectorAll( '.cm-matchingBracket' ).length ).toEqual( 2 );
	} );
} );
