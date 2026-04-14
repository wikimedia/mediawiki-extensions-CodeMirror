import EditPage from '../pageobjects/edit.page.js';
import FixtureContent from '../fixturecontent.js';
import UserPreferences from '../userpreferences.js';
import { createApiClient } from 'wdio-mediawiki/Api.js';
import { getTestString } from 'wdio-mediawiki/Util.js';

describe( 'CodeMirror (enabled) - VisualEditor 2017 wikitext editor', () => {
	let title;

	before( async () => {
		title = getTestString( 'CodeMirror-fixture1-' );
		await UserPreferences.loginAsOther();
		await FixtureContent.createFixturePage( title );
		await UserPreferences.enableWikitext2017EditorWithCodeMirror();
	} );

	it( 'opens with the CodeMirror view displayed and focus set on the VE surface', async () => {
		await EditPage.openForEditing( title );
		await EditPage.visualEditorContentEditable.waitForDisplayed();
		await EditPage.codeMirrorContentEditable.waitForDisplayed();
		await expect( EditPage.codeMirrorContentEditable ).toBeDisplayed();
		expect(
			await browser.execute(
				() => document.activeElement.classList.contains( 've-ce-attachedRootNode' )
			)
		).toBe( true );
	} );

	it( 'updates CodeMirror with VE document changes', async () => {
		await EditPage.clickText();
		// VE registers textSelection on #wpTextbox1.
		await browser.execute( () => $( '#wpTextbox1' ).textSelection( 'setContents', 'foobar' ) );
		expect(
			await browser.execute( () => $( '.cm-editor' ).textSelection( 'getContents' ) )
		).toBe( 'foobar\n' );
	} );

	it( 'retains content when CodeMirror is disabled and maintains focus on VE surface', async () => {
		await EditPage.visualEditorToggleCodeMirror();
		await expect( EditPage.codeMirrorContentEditable ).not.toBeDisplayed();
		expect(
			await browser.execute( () => $( '#wpTextbox1' ).textSelection( 'getContents' ) )
		).toBe( 'foobar\n' );
		expect(
			await browser.execute(
				() => document.activeElement.classList.contains( 've-ce-attachedRootNode' )
			)
		).toBe( true );
	} );

	it( 'retains content when CodeMirror is re-enabled', async () => {
		await browser.execute(
			() => $( '#wpTextbox1' ).textSelection( 'setContents', 'baz' )
		);
		await EditPage.visualEditorToggleCodeMirror();
		await expect( EditPage.codeMirrorContentEditable ).toBeDisplayed();
		expect(
			await browser.execute( () => $( '.cm-editor' ).textSelection( 'getContents' ) )
		).toBe( 'baz\n' );
	} );

	it( 'adjusts gutter accordingly when pasting many lines of wrapping text', async () => {
		await browser.execute(
			() => $( '#wpTextbox1' ).textSelection(
				'setContents',
				( 'foo <div>bar</div> baz'.repeat( 50 ) + '\n' ).repeat( 100 )
			)
		);
		expect(
			await browser.execute( () => $( '.cm-content' ).outerHeight() )
		).toBe(
			await browser.execute( () => $( '.ve-ce-attachedRootNode' ).outerHeight() )
		);
	} );

	it( 'should only load necessary modules when the CodeMirror preference is unset', async () => {
		// Exit editing session.
		await browser.keys( 'Escape' );
		await EditPage.visualEditorMessageDialog.waitForDisplayed();
		await EditPage.visualEditorDestructiveButton.click();
		await expect( EditPage.visualEditorContentEditable ).not.toBeDisplayed();
		await expect( EditPage.codeMirrorContentEditable ).not.toBeDisplayed();
		// Refresh.
		await UserPreferences.setPreferences( {
			usecodemirror: '0'
		} );
		await EditPage.openForEditing( title );
		// Assertions.
		await expect( EditPage.codeMirrorContentEditable ).not.toBeDisplayed();
		await expect( EditPage.visualEditorContentEditable ).toBeDisplayed();
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
