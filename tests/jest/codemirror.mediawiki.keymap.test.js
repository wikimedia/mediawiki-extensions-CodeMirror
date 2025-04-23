/* eslint-disable-next-line n/no-missing-require */
const { EditorView } = require( 'ext.CodeMirror.v6.lib' );
const CodeMirror = require( '../../resources/codemirror.js' );
const mwKeymap = require( '../../resources/codemirror.mediawiki.keymap.js' );

describe( 'CodeMirrorMediaWikiKeymap', () => {
	let cm;

	beforeEach( () => {
		const textarea = document.createElement( 'textarea' );
		const form = document.createElement( 'form' );
		form.appendChild( textarea );
		mockMwConfigGet( { wgCiteResponsiveReferences: true } );
		cm = new CodeMirror( textarea );
		cm.initialize();
		mwKeymap( cm );
	} );

	const headingTestCases = [
		{
			content: 'Foo\nBar',
			start: 0,
			end: 0,
			heading: 2,
			expected: '== Foo ==\nBar'
		},
		{
			content: 'Foo\n\n\nBar',
			start: 4,
			end: 4,
			heading: 3,
			expected: 'Foo\n=== codemirror-keymap-heading-n ===\n\nBar'
		},
		{
			content: 'Foo\n\n\nBar\n\n\nBaz',
			start: 0,
			end: 15,
			heading: 1,
			expected: '= Foo =\n\n\n= Bar =\n\n\n= Baz ='
		}
	];
	it.each( headingTestCases )( 'should add a heading to the content', ( { content, start, end, heading, expected } ) => {
		cm.textSelection.setContents( content );
		cm.textSelection.setSelection( { start, end } );
		cm.view.contentDOM.dispatchEvent( new KeyboardEvent( 'keydown', { key: heading, ctrlKey: true } ) );
		expect( cm.textSelection.getContents() ).toStrictEqual( expected );
	} );

	it( 'should add a reference via Mod-Shift-k if the Cite extension is enabled', () => {
		cm.view.contentDOM.dispatchEvent( new KeyboardEvent( 'keydown', { key: 'K', ctrlKey: true, shiftKey: true } ) );
		expect( cm.textSelection.getContents() ).toStrictEqual( '<ref></ref>' );
	} );

	const formattingTestCases = [
		{
			title: 'italics',
			key: 'i',
			expected: "''Foo''"
		},
		{
			title: 'bold',
			key: 'b',
			expected: "'''Foo'''"
		},
		{
			title: 'link',
			key: 'k',
			expected: '[[Foo]]'
		},
		{
			title: 'subscript',
			key: ',',
			expected: '<sub>Foo</sub>'
		},
		{
			title: 'superscript',
			key: '.',
			expected: '<sup>Foo</sup>'
		},
		{
			title: 'underline',
			key: 'u',
			expected: '<u>Foo</u>'
		},
		{
			title: 'nowiki',
			key: '\\',
			expected: '<nowiki>Foo</nowiki>'
		}
	];
	it.each( formattingTestCases )( '$title', ( { key, expected } ) => {
		cm.textSelection.setContents( 'Foo' );
		cm.textSelection.setSelection( { start: 0, end: 3 } );
		cm.view.contentDOM.dispatchEvent( new KeyboardEvent( 'keydown', {
			key,
			ctrlKey: true
		} ) );
		expect( cm.textSelection.getContents() ).toStrictEqual( expected );
	} );

	it( 'formatting after toggling CM off and on again (T389441)', () => {
		cm.textSelection.setContents( 'Foo' );
		cm.textSelection.setSelection( { start: 0, end: 3 } );
		cm.view.contentDOM.dispatchEvent( new KeyboardEvent( 'keydown', {
			key: 'i',
			ctrlKey: true
		} ) );
		expect( cm.textSelection.getContents() ).toStrictEqual( "''Foo''" );
		cm.toggle();
		cm.textarea.value = 'Foo';
		cm.toggle();
		cm.textSelection.setSelection( { start: 0, end: 3 } );
		cm.view.contentDOM.dispatchEvent( new KeyboardEvent( 'keydown', {
			key: 'i',
			ctrlKey: true
		} ) );
		expect( cm.textSelection.getContents() ).toStrictEqual( "''Foo''" );
	} );

	it( 'should hide the section of the help dialog when the preference is disabled', () => {
		// Setup; Not relevant to the accuracy of the test.
		cm.keymap.preferences = cm.preferences;
		cm.keymap.preferences.registerExtension( 'codeFolding', EditorView.theme(), cm.view );
		// Test
		cm.keymap.showHelpDialog();
		expect( document.querySelector( '.cm-mw-keymap-section--codefolding' ).style.display )
			.toBe( '' );
		cm.preferences.setPreference( 'codeFolding', false );
		expect( document.querySelector( '.cm-mw-keymap-section--codefolding' ).style.display )
			.toBe( 'none' );
	} );
} );
