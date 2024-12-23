'use strict';

const Page = require( 'wdio-mediawiki/Page' );

// Copied from mediawiki-core edit.page.js
class EditPage extends Page {
	async openForEditing( title ) {
		const queryParams = {
			action: 'edit',
			vehidebetadialog: 1,
			hidewelcomedialog: 1,
			cm6enable: 1
		};
		await super.openTitle( title, queryParams );
	}

	get wikiEditorToolbar() {
		return $( '#wikiEditor-ui-toolbar' );
	}

	get legacyTextInput() {
		return $( '#wpTextbox1' );
	}

	get legacyCodeMirrorButton() {
		return $( '#mw-editbutton-codemirror' );
	}

	async clickText() {
		const cm = $( '.cm-content' );
		await cm.isDisplayed();
		await cm.click();
	}

	get visualEditorSave() {
		return $( '.ve-ui-toolbar-saveButton' );
	}

	get visualEditorSurface() {
		return $( '.ve-ui-surface-source' );
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
