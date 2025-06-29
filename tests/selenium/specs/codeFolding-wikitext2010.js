/* global KeyboardEvent, navigator */
'use strict';

const assert = require( 'assert' ),
	EditPage = require( '../pageobjects/edit.page' ),
	FixtureContent = require( '../fixturecontent' ),
	LoginPage = require( 'wdio-mediawiki/LoginPage' ),
	UserPreferences = require( '../userpreferences' ),
	Util = require( 'wdio-mediawiki/Util' );

describe( 'CodeMirror code folding for the wikitext 2010 editor', () => {
	let title, htmlNode, linkNode, nowikiNode, entityNode, refNode;

	before( async () => {
		title = Util.getTestString( 'CodeMirror-fixture1-' );
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
		htmlNode = $( '.cm-mw-htmltag-name' );
		linkNode = $( '.cm-mw-link-pagename' );
		nowikiNode = $( '.cm-mw-tag-nowiki:not(.cm-mw-html-entity)' );
		entityNode = $( '.cm-mw-html-entity' );
		refNode = $( '.cm-mw-tag-ref' );
	} );

	it( 'folds the template parameters via the button', async () => {
		// First make sure the link node is visible.
		assert( await linkNode.waitForDisplayed() );
		// Insert the cursor.
		await browser.execute( () => {
			// Just after the '[[' in '[[link]]'
			$( '.cm-editor' ).textSelection( 'setSelection', { start: 25, end: 25 } );
		} );
		await EditPage.codeMirrorCodeFoldingButton.waitForDisplayed();
		// Fold the template, which should hide the link node.
		await EditPage.codeMirrorCodeFoldingButton.click();
		// The link node should be hidden, while the placeholder should be visible.
		assert( await linkNode.waitForDisplayed( { reverse: true } ) );
		// The html node should not be hidden.
		assert( await htmlNode.waitForDisplayed() );
		assert( await EditPage.codeMirrorCodeFoldingPlaceholder.isDisplayedInViewport() );
	} );

	it( 'expands the template parameters via the button', async () => {
		// The link node should be hidden.
		assert( await linkNode.waitForDisplayed( { reverse: true } ) );
		// Expand the template.
		await EditPage.codeMirrorCodeFoldingPlaceholder.click();
		// The link node should be visible, while the placeholder should be hidden.
		assert( await linkNode.waitForDisplayed() );
		assert(
			await EditPage.codeMirrorCodeFoldingPlaceholder
				.waitForDisplayed( { reverse: true } )
		);
	} );

	it( 'folds the extension tag via the button', async () => {
		// First make sure the extension node is visible.
		assert( await nowikiNode.waitForDisplayed() );
		// Insert the cursor.
		await browser.execute( () => {
			// Just after the '<nowiki>' in '<nowiki>plain text</nowiki>'
			$( '.cm-editor' ).textSelection( 'setSelection', { start: 47, end: 47 } );
		} );
		await EditPage.codeMirrorCodeFoldingButton.waitForDisplayed();
		// Fold the extension tag.
		await EditPage.codeMirrorCodeFoldingButton.click();
		// The extension node should be hidden, while the placeholder should be visible.
		assert( await nowikiNode.waitForDisplayed( { reverse: true } ) );
		// The entity node should not be hidden.
		assert( await entityNode.waitForDisplayed() );
		// The <ref> node should not be hidden.
		assert( await refNode.waitForDisplayed() );
		assert( await EditPage.codeMirrorCodeFoldingPlaceholder.isDisplayedInViewport() );
	} );

	it( 'expands the extension tag via the button', async () => {
		// The extension node should be hidden.
		assert( await nowikiNode.waitForDisplayed( { reverse: true } ) );
		// Expand the extension tag.
		await EditPage.codeMirrorCodeFoldingPlaceholder.click();
		// The extension node should be visible, while the placeholder should be hidden.
		assert( await nowikiNode.waitForDisplayed() );
		assert(
			await EditPage.codeMirrorCodeFoldingPlaceholder
				.waitForDisplayed( { reverse: true } )
		);
	} );

	it( 'folds all via keyboard shortcut', async () => {
		// First make sure all nodes are visible.
		assert( await htmlNode.waitForDisplayed() );
		assert( await linkNode.waitForDisplayed() );
		assert( await nowikiNode.waitForDisplayed() );
		assert( await entityNode.waitForDisplayed() );
		assert( await refNode.waitForDisplayed() );
		// Fold all.
		await browser.execute( () => {
			$( '.cm-content' )[ 0 ].dispatchEvent( new KeyboardEvent( 'keydown', { key: '[', ctrlKey: true, altKey: true } ) );
		} );
		// All nodes should be hidden, while the placeholders should be visible.
		assert( await htmlNode.waitForDisplayed( { reverse: true } ) );
		assert( await linkNode.waitForDisplayed( { reverse: true } ) );
		assert( await nowikiNode.waitForDisplayed( { reverse: true } ) );
		assert( await entityNode.waitForDisplayed( { reverse: true } ) );
		assert( await refNode.waitForDisplayed( { reverse: true } ) );
		assert( await EditPage.codeMirrorCodeFoldingPlaceholder.isDisplayedInViewport() );
	} );

	it( 'expands all via keyboard shortcut', async () => {
		// All nodes should be hidden.
		assert( await htmlNode.waitForDisplayed( { reverse: true } ) );
		assert( await linkNode.waitForDisplayed( { reverse: true } ) );
		assert( await nowikiNode.waitForDisplayed( { reverse: true } ) );
		assert( await entityNode.waitForDisplayed( { reverse: true } ) );
		assert( await refNode.waitForDisplayed( { reverse: true } ) );
		// Expand all.
		await browser.execute( () => {
			$( '.cm-content' )[ 0 ].dispatchEvent( new KeyboardEvent( 'keydown', { key: ']', ctrlKey: true, altKey: true } ) );
		} );
		// All nodes should be visible, while the placeholders should be hidden.
		assert( await htmlNode.waitForDisplayed() );
		assert( await linkNode.waitForDisplayed() );
		assert( await nowikiNode.waitForDisplayed() );
		assert( await entityNode.waitForDisplayed() );
		assert( await refNode.waitForDisplayed() );
		assert(
			await EditPage.codeMirrorCodeFoldingPlaceholder
				.waitForDisplayed( { reverse: true } )
		);
	} );

	it( 'folds all <ref> tags via keyboard shortcut', async () => {
		// First make sure <ref> nodes are visible.
		assert( await refNode.waitForDisplayed() );
		// Fold all.
		await browser.execute( () => {
			// eslint-disable-next-line n/no-unsupported-features/node-builtins
			const modKey = /Mac/.test( navigator.platform ) ? 'metaKey' : 'ctrlKey';
			$( '.cm-content' )[ 0 ].dispatchEvent( new KeyboardEvent( 'keydown', { key: ',', [ modKey ]: true, altKey: true } ) );
		} );
		// The <ref> node should be hidden, while the placeholder should be visible.
		assert( await refNode.waitForDisplayed( { reverse: true } ) );
		// The html node should not be hidden.
		assert( await htmlNode.waitForDisplayed() );
		// The link node should not be hidden.
		assert( await linkNode.waitForDisplayed() );
		// The nowiki node should not be hidden.
		assert( await nowikiNode.waitForDisplayed() );
		assert( await EditPage.codeMirrorCodeFoldingPlaceholder.isDisplayedInViewport() );
	} );
} );
