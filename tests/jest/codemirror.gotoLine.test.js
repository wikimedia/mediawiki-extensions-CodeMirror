/* eslint-disable-next-line n/no-missing-require */
const { StateEffectType, StateField } = require( 'ext.CodeMirror.v6.lib' );
const CodeMirror = require( '../../resources/codemirror.js' );
const CodeMirrorGotoLine = require( '../../resources/codemirror.gotoLine.js' );

describe( 'CodeMirrorGotoLine', () => {
	it( 'constructor', () => {
		const gotoLine = new CodeMirrorGotoLine();
		expect( gotoLine.toggleEffect ).toBeInstanceOf( StateEffectType );
		expect( gotoLine.panelStateField ).toBeInstanceOf( StateField );
	} );

	it( 'should show the goto line panel with Mod-Alt-g and close it with Escape', () => {
		const cm = new CodeMirror( document.createElement( 'textarea' ) );
		cm.initialize();
		cm.view.contentDOM.dispatchEvent(
			new KeyboardEvent( 'keydown', { key: 'g', altKey: true, ctrlKey: true } )
		);
		const panel = cm.view.dom.querySelector( '.cm-mw-goto-line-panel' );
		expect( panel ).toBeTruthy();
		panel.dispatchEvent( new KeyboardEvent( 'keydown', { key: 'Escape' } ) );
		expect( cm.view.dom.querySelector( '.cm-mw-goto-line-panel' ) ).toBeFalsy();
	} );

	it( 'Submission should move the cursor to the specified line', () => {
		const cm = new CodeMirror( document.createElement( 'textarea' ) );
		cm.initialize();
		cm.textSelection.setContents( 'Foobar\n'.repeat( 10 ) );
		cm.textSelection.setSelection( { start: 5 } );
		cm.view.contentDOM.dispatchEvent(
			new KeyboardEvent( 'keydown', { key: 'g', altKey: true, ctrlKey: true } )
		);
		const input = cm.view.dom.querySelector( '[name=line]' );
		expect( input.value ).toStrictEqual( '1' );
		input.value = '3';
		const panel = cm.view.dom.querySelector( '.cm-mw-goto-line-panel' );
		panel.dispatchEvent( new KeyboardEvent( 'keydown', { key: 'Enter' } ) );
		expect( cm.textSelection.getCaretPosition() ).toStrictEqual( 'Foobar\n'.repeat( 2 ).length );
	} );
} );
