'use strict';

const assert = require( 'assert' ),
	EditPage = require( '../pageobjects/edit.page' ),
	FixtureContent = require( '../fixturecontent' ),
	LoginPage = require( 'wdio-mediawiki/LoginPage' ),
	UserPreferences = require( '../userpreferences' ),
	Util = require( 'wdio-mediawiki/Util' );

describe( 'CodeMirror template folding for the wikitext 2010 editor', () => {
	let title, parserFunctionNode;

	before( async () => {
		title = Util.getTestString( 'CodeMirror-fixture1-' );
		await LoginPage.loginAdmin();
		await FixtureContent.createFixturePage( title );
		await UserPreferences.enableWikitext2010EditorWithCodeMirror();
		await EditPage.openForEditing( title, true );
		await EditPage.wikiEditorToolbar.waitForDisplayed();
		await browser.execute( () => {
			$( '.cm-editor' ).textSelection( 'setContents', '{{foo|1={{bar|{{baz|{{PAGENAME}}}}}}}}' );
		} );
		parserFunctionNode = $( '.cm-mw-parserfunction-name' );
	} );

	it( 'folds the template parameters via the button', async () => {
		// First make sure the parser function node is visible.
		assert( await parserFunctionNode.waitForDisplayed() );
		// Insert the cursor.
		await browser.execute( () => {
			// Just after the '{{' in '{{PAGENAME}}'
			$( '.cm-editor' ).textSelection( 'setSelection', { start: 22, end: 22 } );
		} );
		await EditPage.codeMirrorTemplateFoldingButton.waitForDisplayed();
		// Fold the template, which should hide the parser function node.
		await EditPage.codeMirrorTemplateFoldingButton.click();
		// The parser function node should be hidden, while the placeholder should be visible.
		assert( await parserFunctionNode.waitForDisplayed( { reverse: true } ) );
		assert( await EditPage.codeMirrorTemplateFoldingPlaceholder.isDisplayedInViewport() );
	} );

	it( 'expands the template parameters via the button', async () => {
		// Parser function node should be hidden.
		assert( await parserFunctionNode.waitForDisplayed( { reverse: true } ) );
		// Expand the template.
		await EditPage.codeMirrorTemplateFoldingPlaceholder.click();
		// Parser function node should be visible, while the placeholder should be hidden.
		assert( await parserFunctionNode.waitForDisplayed() );
		assert(
			await EditPage.codeMirrorTemplateFoldingPlaceholder
				.waitForDisplayed( { reverse: true } )
		);
	} );
} );
