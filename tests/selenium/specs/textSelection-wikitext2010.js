import EditPage from '../pageobjects/edit.page.js';
import FixtureContent from '../fixturecontent.js';
import UserPreferences from '../userpreferences.js';
import { getTestString } from 'wdio-mediawiki/Util.js';

describe( 'CodeMirror textSelection for the wikitext 2010 editor', () => {
	let title;

	before( async () => {
		title = getTestString( 'CodeMirror-fixture1-' );
		await UserPreferences.loginAsOther();
		await FixtureContent.createFixturePage( title );
		await UserPreferences.enableWikitext2010EditorWithCodeMirror();
		await EditPage.openForEditing( title );
		await EditPage.wikiEditorToolbar.waitForDisplayed();
		await EditPage.codeMirrorButton.waitForDisplayed();
	} );

	// Content is "[]{{template}}"
	it( 'sets and gets the correct text when using setContents and getContents', async () => {
		await browser.execute( () => $( '.cm-editor' ).textSelection( 'setContents', 'foobar' ) );
		expect(
			await browser.execute( () => $( '.cm-editor' ).textSelection( 'getContents' ) )
		).toBe( 'foobar' );
	} );

	it( 'has usage of .val() routed to CodeMirror', async () => {
		await browser.execute( () => $( '#wpTextbox1' ).val( 'baz' ) );
		expect(
			await browser.execute( () => $( '.cm-editor' ).textSelection( 'getContents' ) )
		).toBe( 'baz' );
		// Change back to "foobar" for subsequent tests.
		await browser.execute( () => $( '#wpTextbox1' ).val( 'foobar' ) );
	} );

	// Content is now "foobar"
	it( 'sets and gets the correct selection when using setSelection and getSelection', async () => {
		await browser.execute( () => {
			$( '.cm-editor' ).textSelection( 'setSelection', { start: 3, end: 6 } );
		} );
		expect(
			await browser.execute( () => $( '.cm-editor' ).textSelection( 'getSelection' ) )
		).toBe( 'bar' );
	} );

	it( 'correctly replaces the selected text when using replaceSelection', async () => {
		await browser.execute( () => $( '.cm-editor' ).textSelection( 'replaceSelection', 'baz' ) );
		expect(
			await browser.execute( () => $( '.cm-editor' ).textSelection( 'getContents' ) )
		).toBe( 'foobaz' );
	} );

	// Content is now "foobaz"
	it( 'returns the correct values for getCaretPosition', async () => {
		await browser.execute( () => {
			$( '.cm-editor' ).textSelection( 'setSelection', { start: 3, end: 6 } );
		} );
		expect(
			await browser.execute( () => $( '.cm-editor' ).textSelection( 'getCaretPosition' ) )
		).toBe( 6 );
		expect(
			await browser.execute( () => $( '.cm-editor' ).textSelection( 'getCaretPosition', { startAndEnd: true } ) )
		).toEqual( [ 3, 6 ] );
	} );

	it( 'correctly wraps the selected text when using encapsulateSelection', async () => {
		await browser.execute( () => {
			$( '.cm-editor' ).textSelection( 'setContents', 'foobaz' )
				.textSelection( 'encapsulateSelection', {
					selectionStart: 0,
					selectionEnd: 6,
					pre: '<div>',
					post: '</div>'
				} );
		} );
		expect(
			await browser.execute( () => $( '.cm-editor' ).textSelection( 'getContents' ) )
		).toBe( '<div>foobaz</div>' );
	} );

	it( "correctly inserts the 'peri' option when using encapsulateSelection", async () => {
		await browser.execute( () => {
			$( '.cm-editor' ).textSelection( 'setContents', 'foobaz' )
				.textSelection( 'encapsulateSelection', {
					selectionStart: 0,
					selectionEnd: 6,
					pre: '<div>',
					post: '</div>',
					peri: 'Soundgarden',
					replace: true
				} );
		} );
		expect(
			await browser.execute( () => $( '.cm-editor' ).textSelection( 'getContents' ) )
		).toBe( '<div>Soundgarden</div>' );
	} );

	it( "applies 'pre'/'post' to each line when 'splitlines' is used with encapsulateSelection", async () => {
		await browser.execute( () => {
			const testStr = 'foo\nbar\nbaz';
			$( '.cm-editor' ).textSelection( 'setContents', testStr )
				.textSelection( 'encapsulateSelection', {
					selectionStart: 0,
					selectionEnd: testStr.length,
					pre: '<div>',
					post: '</div>',
					splitlines: true
				} );
		} );
		const expected = '<div>foo</div>\n<div>bar</div>\n<div>baz</div>';
		expect(
			await browser.execute( () => $( '.cm-editor' ).textSelection( 'getContents' ) )
		).toBe( expected );
		expect(
			await browser.execute( () => $( '.cm-editor' ).textSelection( 'getSelection' ) )
		).toBe( expected );
	} );

	it( 'scrolls to the correct place when using scrollToCaretPosition', async () => {
		await browser.execute( () => {
			const $cmEditor = $( '.cm-editor' );
			$cmEditor.textSelection( 'setContents', 'foobar\n'.repeat( 50 ) );
			// Ensure caret is at the top.
			$cmEditor.textSelection( 'setSelection', { start: 0 } );
			// Force scrolling to the bottom.
			$( '.cm-scroller' )[ 0 ].scrollTop = 5000;
			// Use textSelection to scroll back to caret.
			$cmEditor.textSelection( 'scrollToCaretPosition' );
		} );
		expect(
			await browser.execute( () => $( '.cm-scroller' ).scrollTop() )
		).toBe( 0 );
	} );

	// Content is now "foobar\n" repeated 50 times.
	it( 'retains the contents after turning CodeMirror off', async () => {
		await EditPage.codeMirrorButton.click();
		await expect( EditPage.textInput ).toBeDisplayed();
		await expect( EditPage.textInput ).toHaveValue( expect.stringMatching( /foobar/ ) );
	} );
} );
