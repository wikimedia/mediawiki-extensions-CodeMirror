/* eslint-disable-next-line n/no-missing-require */
const { EditorState, syntaxTree } = require( 'ext.CodeMirror.lib' );
/* eslint-disable-next-line n/no-missing-require */
const CodeMirror = require( 'ext.CodeMirror' );
const modes = require( '../../../resources/modes/codemirror.mode.extended.exporter.js' );

describe( 'ext.CodeMirror.modes.extended', () => {
	const modeNames = Object.keys( modes );

	it( 'exports a factory for every mode', () => {
		expect( modeNames.length ).toBeGreaterThan( 0 );
		for ( const name of modeNames ) {
			expect( typeof modes[ name ] ).toBe( 'function' );
		}
	} );

	// CodeMirror takes its mode from `language.name`. Several upstream packages
	// leave that empty or spell it differently, which would give the editor the
	// wrong mode, so the exporter normalizes it.
	it.each( modeNames )( '%s is a LanguageSupport named after the mode', ( name ) => {
		const support = modes[ name ]();
		expect( support.language ).toBeTruthy();
		expect( support.language.name ).toBe( name );
	} );

	it.each( modeNames )( '%s sets the mode on the CodeMirror instance', ( name ) => {
		const cm = new CodeMirror( document.createElement( 'textarea' ), modes[ name ]() );
		expect( cm.mode ).toBe( name );
	} );

	// Proves an upstream LanguageSupport works without a CodeMirrorMode subclass.
	it( 'parses Python without a CodeMirrorMode subclass', () => {
		const state = EditorState.create( {
			doc: 'def f():\n\treturn 1\n',
			extensions: [ modes.python().extension ]
		} );
		const nodeNames = [];
		syntaxTree( state ).iterate( { enter: ( node ) => {
			nodeNames.push( node.name );
		} } );
		expect( nodeNames ).toContain( 'FunctionDefinition' );
	} );
} );
