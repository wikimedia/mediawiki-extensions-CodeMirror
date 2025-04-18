'use strict';

const assert = require( 'assert' ),
	EditPage = require( '../pageobjects/edit.page' ),
	FixtureContent = require( '../fixturecontent' ),
	LoginPage = require( 'wdio-mediawiki/LoginPage' ),
	UserPreferences = require( '../userpreferences' ),
	Util = require( 'wdio-mediawiki/Util' );

describe( 'CodeMirror textSelection for the wikitext 2010 editor', () => {
	let title;

	before( async () => {
		title = Util.getTestString( 'CodeMirror-fixture1-' );
		await LoginPage.loginAdmin();
		await FixtureContent.createFixturePage( title );
		await UserPreferences.enableWikitext2010EditorWithCodeMirror();
		await EditPage.openForEditing( title );
		await EditPage.codeMirrorButton.waitForDisplayed();
	} );

	// Content is "[]{{template}}"
	it( 'sets and gets the correct text when using setContents and getContents', async () => {
		await browser.execute( () => $( '.cm-editor' ).textSelection( 'setContents', 'foobar' ) );
		assert.strictEqual(
			await browser.execute( () => $( '.cm-editor' ).textSelection( 'getContents' ) ),
			'foobar'
		);
	} );

	it( 'has usage of .val() routed to CodeMirror', async () => {
		await browser.execute( () => $( '#wpTextbox1' ).val( 'baz' ) );
		assert.strictEqual(
			await browser.execute( () => $( '.cm-editor' ).textSelection( 'getContents' ) ),
			'baz'
		);
		// Change back to "foobar" for subsequent tests.
		await browser.execute( () => $( '#wpTextbox1' ).val( 'foobar' ) );
	} );

	// Content is now "foobar"
	it( 'sets and gets the correct selection when using setSelection and getSelection', async () => {
		await browser.execute( () => {
			$( '.cm-editor' ).textSelection( 'setSelection', { start: 3, end: 6 } );
		} );
		assert.strictEqual(
			await browser.execute( () => $( '.cm-editor' ).textSelection( 'getSelection' ) ),
			'bar'
		);
	} );

	it( 'correctly replaces the selected text when using replaceSelection', async () => {
		await browser.execute( () => $( '.cm-editor' ).textSelection( 'replaceSelection', 'baz' ) );
		assert.strictEqual(
			await browser.execute( () => $( '.cm-editor' ).textSelection( 'getContents' ) ),
			'foobaz'
		);
	} );

	// Content is now "foobaz"
	it( 'returns the correct values for getCaretPosition', async () => {
		await browser.execute( () => {
			$( '.cm-editor' ).textSelection( 'setSelection', { start: 3, end: 6 } );
		} );
		assert.strictEqual(
			await browser.execute( () => $( '.cm-editor' ).textSelection( 'getCaretPosition' ) ),
			6
		);
		assert.deepStrictEqual(
			await browser.execute( () => $( '.cm-editor' ).textSelection( 'getCaretPosition', { startAndEnd: true } ) ),
			[ 3, 6 ]
		);
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
		assert.strictEqual(
			await browser.execute( () => $( '.cm-editor' ).textSelection( 'getContents' ) ),
			'<div>foobaz</div>'
		);
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
		assert.strictEqual(
			await browser.execute( () => $( '.cm-editor' ).textSelection( 'getContents' ) ),
			'<div>Soundgarden</div>'
		);
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
		assert.strictEqual(
			await browser.execute( () => $( '.cm-editor' ).textSelection( 'getContents' ) ),
			expected
		);
		assert.strictEqual(
			await browser.execute( () => $( '.cm-editor' ).textSelection( 'getSelection' ) ),
			expected
		);
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
		assert.strictEqual(
			await browser.execute( () => $( '.cm-scroller' ).scrollTop() ),
			0
		);
	} );

	// Content is now "foobar\n" repeated 50 times.
	it( 'retains the contents after turning CodeMirror off', async () => {
		await EditPage.codeMirrorButton.click();
		await EditPage.textInput.waitForDisplayed();
		assert.match( await EditPage.textInput.getValue(), /foobar/ );
	} );
} );
