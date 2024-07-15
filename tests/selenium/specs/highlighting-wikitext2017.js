'use strict';

const assert = require( 'assert' ),
	EditPage = require( '../pageobjects/edit.page' ),
	FixtureContent = require( '../fixturecontent' ),
	LoginPage = require( 'wdio-mediawiki/LoginPage' ),
	UserPreferences = require( '../userpreferences' ),
	Util = require( 'wdio-mediawiki/Util' );

// Skipped on 2024-03-20 in 1012801
// Disable as test is consistently failing on CI.
describe.skip( 'CodeMirror bracket match highlighting for the wikitext 2017 editor', () => {
	let title;

	before( async () => {
		title = Util.getTestString( 'CodeMirror-fixture1-' );
		await LoginPage.loginAdmin();
		await FixtureContent.createFixturePage( title );
		await UserPreferences.enableWikitext2017EditorWithCodeMirror();
	} );

	beforeEach( async () => {
		await EditPage.openForEditing( title );
		await EditPage.visualEditorSave.waitForDisplayed();
		assert( !( await EditPage.wikiEditorToolbar.isDisplayed() ) );
		await EditPage.clickText();
	} );

	it( 'highlights matching bracket', async () => {
		await EditPage.cursorToPosition( 0 );
		assert.strictEqual( await EditPage.getHighlightedMatchingBrackets(), '[]' );
	} );

	it( 'matches according to cursor movement', async () => {
		await EditPage.cursorToPosition( 3 );
		assert.strictEqual( await EditPage.getHighlightedMatchingBrackets(), '{}' );
	} );
} );
