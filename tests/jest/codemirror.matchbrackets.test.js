const CodeMirror = require( '../../resources/codemirror.js' );
const { mediawiki } = require( '../../resources/modes/mediawiki/codemirror.mediawiki.js' );
const { javascript } = require( '../../resources/modes/codemirror.javascript.js' );

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
} );
