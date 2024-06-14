'use strict';

const assert = require( 'assert' ),
	EditPage = require( '../pageobjects/edit.page' ),
	FixtureContent = require( '../fixturecontent' ),
	UserPreferences = require( '../userpreferences' ),
	Util = require( 'wdio-mediawiki/Util' );

describe( 'CodeMirror bracket match highlighting for the wikitext 2010 editor', () => {
	let title;

	before( async () => {
		title = Util.getTestString( 'CodeMirror-fixture1-' );
		await UserPreferences.loginAsOther();
		await FixtureContent.createFixturePage( title );
		await UserPreferences.enableWikitext2010EditorWithCodeMirror();
	} );

	beforeEach( async () => {
		await EditPage.openForEditing( title );
		await EditPage.wikiEditorToolbar.waitForDisplayed();
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
