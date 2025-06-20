// eslint-disable-next-line n/no-missing-require
const { Text } = require( 'ext.CodeMirror.v6.lib' );
const CodeMirrorLint = require( '../../resources/codemirror.lint.js' );

const cmLint = new CodeMirrorLint();
const { dom, update } = cmLint.panel;
const doc = Text.of( [ 'foo', 'bar' ] );
const apply = jest.fn();

const updateSelection = ( anchor, head ) => {
	update( {
		state: {
			doc,
			selection: { main: { anchor, head } }
		},
		transactions: [],
		selectionSet: true
	} );
};

describe( 'CodeMirrorLint', () => {
	beforeEach( () => {
		cmLint.diagnostics = [
			{
				from: 0,
				to: 1,
				severity: 'error',
				message: 'Error message',
				actions: [
					{
						name: 'Fix',
						apply
					},
					{
						name: 'Suggestion',
						apply
					}
				]
			},
			{
				from: 0,
				to: 1,
				severity: 'warning',
				message: 'Warning message'
			},
			{
				from: 0,
				to: 1,
				severity: 'info',
				message: 'Info message'
			}
		];
	} );

	it( 'should contain 3 parts', () => {
		expect( dom.childElementCount ).toEqual( 3 );
		expect( dom.firstChild.className ).toEqual( 'cm-mw-panel--status-worker' );
		expect( dom.firstChild.childElementCount ).toEqual( 3 );
		expect( dom.firstChild.firstChild.className ).toEqual( 'cm-mw-panel--status-error' );
		expect( dom.firstChild.firstChild.lastChild.textContent ).toEqual( '0' );
		expect( dom.firstChild.children[ 1 ].className ).toEqual( 'cm-mw-panel--status-warning' );
		expect( dom.firstChild.children[ 1 ].lastChild.textContent ).toEqual( '0' );
		expect( dom.firstChild.lastChild.className ).toEqual( 'cm-mw-panel--status-info' );
		expect( dom.firstChild.lastChild.lastChild.textContent ).toEqual( '0' );
		expect( dom.children[ 1 ].className ).toEqual( 'cm-mw-panel--status-message' );
		expect( dom.lastChild.className ).toEqual( 'cm-mw-panel--status-line' );
	} );

	it( 'should update the diagnostics count', () => {
		const errorText = dom.querySelector( '.cm-mw-panel--status-error' ).lastChild;
		const warningText = dom.querySelector( '.cm-mw-panel--status-warning' ).lastChild;
		const infoText = dom.querySelector( '.cm-mw-panel--status-info' ).lastChild;
		cmLint.updateDiagnosticsCount( 'error', errorText );
		cmLint.updateDiagnosticsCount( 'warning', warningText );
		cmLint.updateDiagnosticsCount( 'info', infoText );
		expect( errorText.textContent ).toEqual( '1' );
		expect( warningText.textContent ).toEqual( '1' );
		expect( infoText.textContent ).toEqual( '1' );
	} );

	it( 'should update the diagnostic message', () => {
		const message = dom.querySelector( '.cm-mw-panel--status-message' );
		cmLint.updateDiagnosticMessage( 0, message );
		expect( message.textContent ).toEqual( 'Error messageFixSuggestion' );
		cmLint.updateDiagnosticMessage( 2, message );
		expect( message.textContent ).toEqual( '' );
		cmLint.updateDiagnosticMessage( 1, message );
		expect( message.textContent ).toEqual( 'Error messageFixSuggestion' );
		for ( const button of message.querySelectorAll( 'button' ) ) {
			button.click();
		}
		expect( apply ).toHaveBeenCalledTimes( 2 );
	} );

	it( 'should update the position/selection', () => {
		const line = dom.lastChild;
		updateSelection( 1, 1 );
		expect( line.textContent ).toEqual( '1:1' );
		updateSelection( 1, 6 );
		expect( line.textContent ).toEqual( '2:2|(1:1)' );
		updateSelection( 5, 2 );
		expect( line.textContent ).toEqual( '1:2|(1:0)' );
	} );
} );
