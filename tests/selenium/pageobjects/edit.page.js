'use strict';

const Page = require( 'wdio-mediawiki/Page' );

// Copied from mediawiki-core edit.page.js
class EditPage extends Page {
	async openForEditing( title, queryParams = {} ) {
		queryParams = Object.assign( {
			action: 'edit',
			vehidebetadialog: 1,
			hidewelcomedialog: 1,
			cm6enable: 1
		}, queryParams );
		await super.openTitle( title, queryParams );
	}

	get wikiEditorToolbar() {
		return $( '#wikiEditor-ui-toolbar' );
	}

	get textInput() {
		return $( '#wpTextbox1' );
	}

	get codeMirrorButton() {
		return $( '#mw-editbutton-codemirror' );
	}

	get codeMirrorContentEditable() {
		return $( '.cm-content' );
	}

	async clickText() {
		await this.codeMirrorContentEditable.isDisplayed();
		await this.codeMirrorContentEditable.click();
	}

	get visualEditorContentEditable() {
		return $( '.ve-ce-attachedRootNode' );
	}

	get visualEditorPageMenu() {
		return $( '.ve-ui-toolbar-group-pageMenu' );
	}

	get visualEditorCodeMirrorButton() {
		return $( '.oo-ui-tool-name-codeMirror' );
	}

	get visualEditorMessageDialog() {
		return $( '.oo-ui-messageDialog-actions' );
	}

	get visualEditorDestructiveButton() {
		return $( '.oo-ui-flaggedElement-destructive' );
	}

	async visualEditorToggleCodeMirror() {
		await this.visualEditorPageMenu.waitForDisplayed();
		await this.visualEditorPageMenu.click();
		await this.visualEditorCodeMirrorButton.waitForDisplayed();
		await this.visualEditorCodeMirrorButton.click();
	}

	get codeMirrorCodeFoldingButton() {
		return $( '.cm-tooltip-fold' );
	}

	get codeMirrorCodeFoldingPlaceholder() {
		return $( '.cm-foldPlaceholder' );
	}

	get highlightedBracket() {
		return $( '.cm-line .cm-matchingBracket' );
	}

	get highlightedBrackets() {
		return $$( '.cm-line .cm-matchingBracket' );
	}

	async getHighlightedMatchingBrackets() {
		const matchingTexts = await this.highlightedBrackets.map( ( el ) => el.getText() );
		return matchingTexts.join( '' );
	}
}

module.exports = new EditPage();
