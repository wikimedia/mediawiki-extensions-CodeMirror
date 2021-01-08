'use strict';

const assert = require( 'assert' ),
	EditPage = require( '../pageobjects/edit.page' ),
	FeatureFlag = require( '../highlightingfeatureflag' ),
	FixtureContent = require( '../fixturecontent' ),
	LoginPage = require( 'wdio-mediawiki/LoginPage' ),
	UserPreferences = require( '../userpreferences' );

describe( 'CodeMirror bracket match default', function () {
	before( function () {
		LoginPage.loginAdmin();
		this.title = FixtureContent.createFixturePage();
		UserPreferences.enableWikitext2010EditorWithCodeMirror();
		// FIXME: Unknown conflict between this test and the FeatureFlag.enable cases.
	} );

	it( 'is disabled by default', function () {
		EditPage.openForEditing( this.title );
		EditPage.clickText();

		EditPage.cursorToPosition( 0 );
		assert.strictEqual( EditPage.getHighlightedMatchingBrackets(), '' );
	} );

	after( function () {
		browser.reloadSession();
	} );
} );

describe( 'CodeMirror bracket match highlighting for the wikitext 2010 editor', function () {
	before( function () {
		LoginPage.loginAdmin();
		this.title = FixtureContent.createFixturePage();
		UserPreferences.enableWikitext2010EditorWithCodeMirror();
		FeatureFlag.enable();
	} );

	beforeEach( function () {
		EditPage.openForEditing( this.title );
		EditPage.clickText();
	} );

	it( 'highlighted on initial load', function () {
		EditPage.cursorToPosition( 0 );
		assert.strictEqual( EditPage.getHighlightedMatchingBrackets(), '[]' );
	} );

	it( 'bracket match highlighting moves along with the cursor', function () {
		EditPage.cursorToPosition( 3 );
		// FIXME: wait for hook to fire
		browser.pause( 100 );
		assert.strictEqual( EditPage.getHighlightedMatchingBrackets(), '{}' );
	} );
} );
