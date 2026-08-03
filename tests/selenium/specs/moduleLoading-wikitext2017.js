import EditPage from '../pageobjects/edit.page.js';
import FixtureContent from '../fixturecontent.js';
import UserPreferences from '../userpreferences.js';
import { createApiClient } from 'wdio-mediawiki/Api.js';
import { getTestString } from 'wdio-mediawiki/Util.js';

describe( 'CodeMirror (disabled) - VisualEditor 2017 wikitext editor', () => {
	let title;

	before( async () => {
		title = getTestString( 'CodeMirror-fixture1-' );
		await UserPreferences.loginAsOther();
		await FixtureContent.createFixturePage( title );
		await UserPreferences.enableWikitext2017EditorWithCodeMirror( { usecodemirror: '0' } );
	} );

	it( 'should only load necessary modules when the CodeMirror preference is unset', async () => {
		await EditPage.openForEditing( title );
		await EditPage.visualEditorContentEditable.waitForDisplayed();
		await expect( EditPage.codeMirrorContentEditable ).not.toBeDisplayed();
		expect(
			await browser.execute( () => mw.loader.getState( 'ext.CodeMirror.mode.mediawiki' ) )
		).toBe( 'registered' );
		expect(
			await browser.execute( () => mw.loader.getState( 'ext.CodeMirror' ) )
		).toBe( 'registered' );
	} );

	after( async () => {
		const apiClient = await createApiClient();
		await apiClient.delete( title, 'Test cleanup' ).catch( ( e ) => console.error( e ) );
	} );
} );
