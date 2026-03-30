import EditPage from '../pageobjects/edit.page.js';
import FixtureContent from '../fixturecontent.js';
import LoginPage from 'wdio-mediawiki/LoginPage.js';
import UserPreferences from '../userpreferences.js';
import { getTestString } from 'wdio-mediawiki/Util.js';

describe( 'CodeMirror code folding for the wikitext 2010 editor', () => {
	let title, htmlNode, linkNode, nowikiNode, entityNode, refNode, hasRef;

	before( async () => {
		title = getTestString( 'CodeMirror-fixture1-' );
		await LoginPage.loginAdmin();
		await FixtureContent.createFixturePage( title );
		await UserPreferences.enableWikitext2010EditorWithCodeMirror();
		await EditPage.openForEditing( title );
		await EditPage.wikiEditorToolbar.waitForDisplayed();
		await browser.execute( () => {
			$( '.cm-editor' ).textSelection(
				'setContents',
				'{{foo|1={{bar|<p>{{baz|[[link]]}}}}}}<nowiki>plain text</nowiki><ref><nowiki>&lt;</nowiki></ref>'
			);
		} );
		// References are provided by the Cite extension which might not be available
		hasRef = await browser.execute( () => 'ref' in mw.config.get( 'extCodeMirrorConfig' ).tags );
		htmlNode = $( '.cm-mw-htmltag-name' );
		linkNode = $( '.cm-mw-link-pagename' );
		nowikiNode = $( '.cm-mw-tag-nowiki:not(.cm-mw-html-entity)' );
		entityNode = $( '.cm-mw-html-entity' );
		refNode = $( '.cm-mw-tag-ref' );
	} );

	it( 'folds the template parameters via the button', async () => {
		// First make sure the link node is visible.
		await expect( linkNode ).toBeDisplayed();
		// Insert the cursor.
		await browser.execute( () => {
			// Just after the '[[' in '[[link]]'
			$( '.cm-editor' ).textSelection( 'setSelection', { start: 25, end: 25 } );
		} );
		await EditPage.codeMirrorCodeFoldingButton.waitForDisplayed();
		// Fold the template, which should hide the link node.
		await EditPage.codeMirrorCodeFoldingButton.click();
		// The link node should be hidden, while the placeholder should be visible.
		await expect( linkNode ).not.toBeDisplayed();
		// The html node should not be hidden.
		await expect( htmlNode ).toBeDisplayed();
		await expect( EditPage.codeMirrorCodeFoldingPlaceholder ).toBeDisplayed();
	} );

	it( 'expands the template parameters via the button', async () => {
		// The link node should be hidden.
		await expect( linkNode ).not.toBeDisplayed();
		// Expand the template.
		await EditPage.codeMirrorCodeFoldingPlaceholder.click();
		// The link node should be visible, while the placeholder should be hidden.
		await expect( linkNode ).toBeDisplayed();
		await expect( EditPage.codeMirrorCodeFoldingPlaceholder ).not.toBeDisplayed();
	} );

	it( 'folds the extension tag via the button', async () => {
		// First make sure the extension node is visible.
		await expect( nowikiNode ).toBeDisplayed();
		// Insert the cursor.
		await browser.execute( () => {
			// Just after the '<nowiki>' in '<nowiki>plain text</nowiki>'
			$( '.cm-editor' ).textSelection( 'setSelection', { start: 47, end: 47 } );
		} );
		await EditPage.codeMirrorCodeFoldingButton.waitForDisplayed();
		// Fold the extension tag.
		await EditPage.codeMirrorCodeFoldingButton.click();
		// The extension node should be hidden, while the placeholder should be visible.
		await expect( nowikiNode ).not.toBeDisplayed();
		// The entity node should not be hidden.
		await expect( entityNode ).toBeDisplayed();
		if ( hasRef ) {
			// The <ref> node should not be hidden.
			await expect( refNode ).toBeDisplayed();
		}
		await expect( EditPage.codeMirrorCodeFoldingPlaceholder ).toBeDisplayed();
	} );

	it( 'expands the extension tag via the button', async () => {
		// The extension node should be hidden.
		await expect( nowikiNode ).not.toBeDisplayed();
		// Expand the extension tag.
		await EditPage.codeMirrorCodeFoldingPlaceholder.click();
		// The extension node should be visible, while the placeholder should be hidden.
		await expect( nowikiNode ).toBeDisplayed();
		await expect( EditPage.codeMirrorCodeFoldingPlaceholder ).not.toBeDisplayed();
	} );

	it( 'folds all via keyboard shortcut', async () => {
		// First make sure all nodes are visible.
		await expect( htmlNode ).toBeDisplayed();
		await expect( linkNode ).toBeDisplayed();
		await expect( nowikiNode ).toBeDisplayed();
		await expect( entityNode ).toBeDisplayed();
		if ( hasRef ) {
			await expect( refNode ).toBeDisplayed();
		}
		// Fold all.
		await $( '.cm-content' ).click();
		await browser.keys( [ 'Control', 'Alt', '[' ] );
		// All nodes should be hidden, while the placeholders should be visible.
		await expect( htmlNode ).not.toBeDisplayed();
		await expect( linkNode ).not.toBeDisplayed();
		await expect( nowikiNode ).not.toBeDisplayed();
		await expect( entityNode ).not.toBeDisplayed();
		if ( hasRef ) {
			await expect( refNode ).not.toBeDisplayed();
		}
		await expect( EditPage.codeMirrorCodeFoldingPlaceholder ).toBeDisplayed();
	} );

	it( 'expands all via keyboard shortcut', async () => {
		// All nodes should be hidden.
		await expect( htmlNode ).not.toBeDisplayed();
		await expect( linkNode ).not.toBeDisplayed();
		await expect( nowikiNode ).not.toBeDisplayed();
		await expect( entityNode ).not.toBeDisplayed();
		if ( hasRef ) {
			await expect( refNode ).not.toBeDisplayed();
		}
		// Expand all.
		await $( '.cm-content' ).click();
		await browser.keys( [ 'Control', 'Alt', ']' ] );
		// All nodes should be visible, while the placeholders should be hidden.
		await expect( htmlNode ).toBeDisplayed();
		await expect( linkNode ).toBeDisplayed();
		await expect( nowikiNode ).toBeDisplayed();
		await expect( entityNode ).toBeDisplayed();
		if ( hasRef ) {
			await expect( refNode ).toBeDisplayed();
		}
		await expect( EditPage.codeMirrorCodeFoldingPlaceholder ).not.toBeDisplayed();
	} );

	it( 'folds all <ref> tags via keyboard shortcut', async function () {
		if ( !hasRef ) {
			this.skip();
		}
		// First make sure <ref> nodes are visible.
		await expect( refNode ).toBeDisplayed();
		// Fold all <ref> tags. Uses Mod (Cmd on Mac, Ctrl elsewhere) + Alt + ','
		const isMac = process.platform === 'darwin';
		await $( '.cm-content' ).click();
		await browser.keys( [ isMac ? 'Meta' : 'Control', 'Alt', ',' ] );
		// The <ref> node should be hidden, while the placeholder should be visible.
		await expect( refNode ).not.toBeDisplayed();
		// The html node should not be hidden.
		await expect( htmlNode ).toBeDisplayed();
		// The link node should not be hidden.
		await expect( linkNode ).toBeDisplayed();
		// The nowiki node should not be hidden.
		await expect( nowikiNode ).toBeDisplayed();
		await expect( EditPage.codeMirrorCodeFoldingPlaceholder ).toBeDisplayed();
	} );
} );
