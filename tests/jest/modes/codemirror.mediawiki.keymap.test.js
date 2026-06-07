/* eslint-disable-next-line n/no-missing-require */
const CodeMirror = require( '../../../resources/codemirror.js' );
const { mediawiki } = require( '../../../resources/modes/mediawiki/codemirror.mediawiki.js' );
const mwKeymap = require( '../../../resources/modes/mediawiki/codemirror.mediawiki.keymap.js' );

describe( 'CodeMirrorMediaWikiKeymap', () => {
	let cm, textarea;

	beforeEach( () => {
		textarea = document.createElement( 'textarea' );
		const form = document.createElement( 'form' );
		form.appendChild( textarea );
		mockMwConfigGet( { wgCiteResponsiveReferences: true } );
		cm = new CodeMirror( textarea, mediawiki() );
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
		// Sanity checks.
		expect( cm.preferences.getPreference( 'codeFolding' ) ).toBeTruthy();
		expect( cm.extensionRegistry.get( 'codeFolding' ) ).toBeDefined();
		// Test
		cm.keymap.showHelpDialog();
		expect( cm.keymap.dialog.querySelector( '.cm-mw-keymap-section--codefolding' ).style.display )
			.toBe( '' );
		// Close and disable codeFolding.
		cm.keymap.animateDialog( false );
		cm.preferences.setPreference( 'codeFolding', false );
		expect( cm.keymap.dialog ).toBeNull();
		// Show again and assert the codeFolding section is hidden.
		cm.keymap.showHelpDialog();
		expect( cm.keymap.dialog.querySelector( '.cm-mw-keymap-section--codefolding' ).style.display )
			.toBe( 'none' );
	} );

	it( 'should prevent shortcuts from changing content in readonly mode', () => {
		textarea.readOnly = true;
		textarea.value = 'Metallica Rules!';
		cm = new CodeMirror( textarea, mediawiki() );
		cm.initialize();
		mwKeymap( cm );
		expect( cm.view.state.readOnly ).toBe( true );
		cm.textSelection.setSelection( { start: 0, end: 5 } );
		cm.view.contentDOM.dispatchEvent( new KeyboardEvent( 'keydown', {
			key: 'b',
			ctrlKey: true
		} ) );
		expect( cm.textSelection.getContents() ).toBe( 'Metallica Rules!' );
		expect( cm.textSelection.getSelection() ).toBe( 'Metal' );
	} );

	it( 'should keep the indentation when inserting a new line', () => {
		textarea.value = '\t\tfoo';
		cm = new CodeMirror( textarea, mediawiki() );
		cm.initialize();

		// Indent the new line with the same indentation as the previous line
		cm.textSelection.setSelection( { start: 2 } );
		cm.view.contentDOM.dispatchEvent( new KeyboardEvent( 'keydown', {
			key: 'Enter'
		} ) );
		expect( cm.textSelection.getContents() ).toBe( '\t\t\n\t\tfoo' );
		expect( cm.textSelection.getCaretPosition() ).toBe( 5 );

		// Do not indent the new line if the cursor is before the indentation of the previous line
		cm.textSelection.setSelection( { start: 0 } );
		cm.view.contentDOM.dispatchEvent( new KeyboardEvent( 'keydown', {
			key: 'Enter'
		} ) );
		expect( cm.textSelection.getContents() ).toBe( '\n\t\t\n\t\tfoo' );
		expect( cm.textSelection.getCaretPosition() ).toBe( 1 );

		// Partial indentation should be preserved
		cm.textSelection.setSelection( { start: 2 } );
		cm.view.contentDOM.dispatchEvent( new KeyboardEvent( 'keydown', {
			key: 'Enter'
		} ) );
		expect( cm.textSelection.getContents() ).toBe( '\n\t\n\t\t\n\t\tfoo' );
		expect( cm.textSelection.getCaretPosition() ).toBe( 4 );
	} );
} );
