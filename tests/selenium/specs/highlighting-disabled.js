'use strict';

const assert = require( 'assert' ),
	EditPage = require( '../pageobjects/edit.page' ),
	FixtureContent = require( '../fixturecontent' ),
	LoginPage = require( 'wdio-mediawiki/LoginPage' ),
	UserPreferences = require( '../userpreferences' );

describe( 'CodeMirror bracket match default', function () {
	before( function () {
		LoginPage.loginAdmin();
		UserPreferences.enableWikitext2010EditorWithCodeMirror();
		this.title = FixtureContent.createFixturePage();
	} );

	it( 'disables highlighting', function () {
		EditPage.openForEditing( this.title );
		EditPage.wikiEditorToolbar.waitForDisplayed();
		EditPage.clickText();

		EditPage.cursorToPosition( 0 );
		assert.strictEqual( EditPage.getHighlightedMatchingBrackets(), '' );
	} );
} );
