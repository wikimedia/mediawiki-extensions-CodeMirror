/* eslint-disable-next-line n/no-missing-require */
const { foldable } = require( 'ext.CodeMirror.v6.lib' );
const CodeMirror = require( '../../../resources/codemirror.js' );
const { lua } = require( '../../../resources/modes/codemirror.lua.js' );

// Setup CodeMirror instance.
const textarea = document.createElement( 'textarea' );
document.body.appendChild( textarea );
const cm = new CodeMirror( textarea, lua() );
cm.initialize();

const test = ( insert, result ) => {
	cm.view.dispatch( {
		changes: { from: 0, to: cm.view.state.doc.length, insert }
	} );
	expect( foldable( cm.view.state, 0, insert.indexOf( '\n' ) ) ).toEqual( result );
};

describe( 'Lua folding', () => {
	it( 'no folding', () => {
		test( 'a\n\nb', null );
		test( '\ta\n\t\t\n    b', null );
		test( '\ta\nb', null );
	} );
	it( 'folding', () => {
		test( 'a\n\tb\n\tc\nd', { from: 1, to: 7 } );
		test( 'a\n  b\n    c\n  d\ne', { from: 1, to: 15 } );
		test( '\ta\n\t\tb\n\tc', { from: 2, to: 6 } );
	} );
} );
