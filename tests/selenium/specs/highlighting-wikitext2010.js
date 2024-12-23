'use strict';

const assert = require( 'assert' ),
	EditPage = require( '../pageobjects/edit.page' ),
	FixtureContent = require( '../fixturecontent' ),
	UserPreferences = require( '../userpreferences' ),
	Api = require( 'wdio-mediawiki/Api.js' ),
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
		await browser.execute( () => {
			$( '.cm-editor' ).textSelection( 'setSelection', { start: 0, end: 0 } );
		} );
		assert( await EditPage.highlightedBracket.waitForDisplayed() );
		assert.strictEqual( await EditPage.getHighlightedMatchingBrackets(), '[]' );
	} );

	it( 'matches according to cursor movement', async () => {
		await browser.execute( () => {
			$( '.cm-editor' ).textSelection( 'setSelection', { start: 3, end: 3 } );
		} );
		assert( await EditPage.highlightedBracket.waitForDisplayed() );
		assert.strictEqual( await EditPage.getHighlightedMatchingBrackets(), '{}' );
	} );

	after( async () => {
		const bot = await Api.bot();
		bot.delete( title, 'Test cleanup' ).catch( ( e ) => console.error( e ) );
	} );
} );
