import EditPage from '../pageobjects/edit.page.js';
import FixtureContent from '../fixturecontent.js';
import UserPreferences from '../userpreferences.js';
import { createApiClient } from 'wdio-mediawiki/Api.js';
import { getTestString } from 'wdio-mediawiki/Util.js';

describe( 'CodeMirror bracket match highlighting for the wikitext 2010 editor', () => {
	let title;

	before( async () => {
		title = getTestString( 'CodeMirror-fixture1-' );
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
		await expect( EditPage.highlightedBracket ).toBeDisplayed();
		expect( await EditPage.getHighlightedMatchingBrackets() ).toBe( '[]' );
	} );

	it( 'matches according to cursor movement', async () => {
		await browser.execute( () => {
			$( '.cm-editor' ).textSelection( 'setSelection', { start: 3, end: 3 } );
		} );
		await expect( EditPage.highlightedBracket ).toBeDisplayed();
		expect( await EditPage.getHighlightedMatchingBrackets() ).toBe( '{}' );
	} );

	after( async () => {
		const apiClient = await createApiClient();
		await apiClient.delete( title, 'Test cleanup' ).catch( ( e ) => console.error( e ) );
	} );
} );
