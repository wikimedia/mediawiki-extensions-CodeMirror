'use strict';

const assert = require( 'assert' ),
	EditPage = require( '../pageobjects/edit.page' ),
	FeatureFlag = require( '../highlightingfeatureflag' ),
	FixtureContent = require( '../fixturecontent' ),
	LoginPage = require( 'wdio-mediawiki/LoginPage' ),
	UserPreferences = require( '../userpreferences' );

describe( 'CodeMirror bracket match highlighting for the wikitext 2017 editor', function () {
	before( function () {
		LoginPage.loginAdmin();
		this.title = FixtureContent.createFixturePage();
		UserPreferences.enableWikitext2017EditorWithCodeMirror();
		FeatureFlag.enable();
	} );

	beforeEach( function () {
		EditPage.openForEditing( this.title );
		EditPage.visualEditorSave.waitForDisplayed();
		assert( !EditPage.wikiEditorToolbar.isDisplayed() );
		EditPage.clickText();
	} );

	it( 'highlights matching bracket', function () {
		EditPage.cursorToPosition( 0 );
		assert.strictEqual( EditPage.getHighlightedMatchingBrackets(), '[]' );
	} );

	it( 'matches according to cursor movement', function () {
		EditPage.cursorToPosition( 3 );
		// FIXME: wait for hook to fire
		browser.pause( 100 );
		assert.strictEqual( EditPage.getHighlightedMatchingBrackets(), '{}' );
	} );
} );
