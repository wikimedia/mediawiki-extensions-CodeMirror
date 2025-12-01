/* global document */
'use strict';

const assert = require( 'assert' ),
	EditPage = require( '../pageobjects/edit.page' ),
	FixtureContent = require( '../fixturecontent' ),
	UserPreferences = require( '../userpreferences' ),
	Api = require( 'wdio-mediawiki/Api.js' ),
	Util = require( 'wdio-mediawiki/Util' );

describe( 'CodeMirror (enabled) - VisualEditor 2017 wikitext editor', () => {
	let title;

	before( async () => {
		title = Util.getTestString( 'CodeMirror-fixture1-' );
		await UserPreferences.loginAsOther();
		await FixtureContent.createFixturePage( title );
		await UserPreferences.enableWikitext2017EditorWithCodeMirror();
	} );

	it( 'opens with the CodeMirror view displayed and focus set on the VE surface', async () => {
		await EditPage.openForEditing( title );
		await EditPage.visualEditorContentEditable.waitForDisplayed();
		await EditPage.codeMirrorContentEditable.waitForDisplayed();
		assert.strictEqual(
			await EditPage.codeMirrorContentEditable.isDisplayed(),
			true
		);
		assert.strictEqual(
			await browser.execute(
				() => document.activeElement.classList.contains( 've-ce-attachedRootNode' )
			),
			true
		);
	} );

	it( 'updates CodeMirror with VE document changes', async () => {
		await EditPage.clickText();
		// VE registers textSelection on #wpTextbox1.
		await browser.execute( () => $( '#wpTextbox1' ).textSelection( 'setContents', 'foobar' ) );
		assert.strictEqual(
			await browser.execute( () => $( '.cm-editor' ).textSelection( 'getContents' ) ),
			'foobar\n'
		);
	} );

	it( 'retains content when CodeMirror is disabled and maintains focus on VE surface', async () => {
		await EditPage.visualEditorToggleCodeMirror();
		await EditPage.codeMirrorContentEditable.waitForDisplayed( { reverse: true } );
		assert.strictEqual(
			await browser.execute( () => $( '#wpTextbox1' ).textSelection( 'getContents' ) ),
			'foobar\n'
		);
		assert.strictEqual(
			await browser.execute(
				() => document.activeElement.classList.contains( 've-ce-attachedRootNode' )
			),
			true
		);
	} );

	it( 'retains content when CodeMirror is re-enabled', async () => {
		await browser.execute(
			() => $( '#wpTextbox1' ).textSelection( 'setContents', 'baz' )
		);
		await EditPage.visualEditorToggleCodeMirror();
		await EditPage.codeMirrorContentEditable.waitForDisplayed();
		assert.strictEqual(
			await browser.execute( () => $( '.cm-editor' ).textSelection( 'getContents' ) ),
			'baz\n'
		);
	} );

	it( 'adjusts gutter accordingly when pasting many lines of wrapping text', async () => {
		await browser.execute(
			() => $( '#wpTextbox1' ).textSelection(
				'setContents',
				( 'foo <div>bar</div> baz'.repeat( 50 ) + '\n' ).repeat( 100 )
			)
		);
		assert.strictEqual(
			await browser.execute( () => $( '.cm-content' ).outerHeight() ),
			await browser.execute( () => $( '.ve-ce-attachedRootNode' ).outerHeight() )
		);
	} );

	it( 'should only load necessary modules when the CodeMirror preference is unset', async () => {
		// Exit editing session.
		await browser.keys( 'Escape' );
		await EditPage.visualEditorMessageDialog.waitForDisplayed();
		await EditPage.visualEditorDestructiveButton.click();
		await EditPage.visualEditorContentEditable.waitForDisplayed( { reverse: true } );
		assert.strictEqual(
			await EditPage.codeMirrorContentEditable.isDisplayed(),
			false
		);
		// Refresh.
		await UserPreferences.setPreferences( {
			usecodemirror: '0'
		} );
		await EditPage.openForEditing( title );
		// Assertions.
		await EditPage.codeMirrorContentEditable.waitForDisplayed( { reverse: true } );
		await EditPage.visualEditorContentEditable.waitForDisplayed();
		assert.strictEqual(
			await browser.execute( () => mw.loader.getState( 'ext.CodeMirror.v6.mode.mediawiki' ) ),
			'registered'
		);
		assert.strictEqual(
			await browser.execute( () => mw.loader.getState( 'ext.CodeMirror.v6' ) ),
			'registered'
		);
	} );

	after( async () => {
		const bot = await Api.bot();
		bot.delete( title, 'Test cleanup' ).catch( ( e ) => console.error( e ) );
	} );
} );
