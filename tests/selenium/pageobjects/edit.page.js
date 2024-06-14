'use strict';

const Page = require( 'wdio-mediawiki/Page' );

// Copied from mediawiki-core edit.page.js
class EditPage extends Page {
	async openForEditing( title, cm6enable = false ) {
		const queryParams = {
			action: 'edit',
			vehidebetadialog: 1,
			hidewelcomedialog: 1
		};
		if ( cm6enable ) {
			queryParams.cm6enable = '1';
		}
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
		if ( await this.visualEditorSave.isDisplayed() ) {
			await this.visualEditorSurface.click();
		} else if ( await this.legacyTextInput.isDisplayed() ) {
			await this.legacyTextInput.click();
		} else {
			// Click the container, if using WikiEditor etc.
			await this.legacyTextInput.parentElement().click();
		}
	}

	get visualEditorSave() {
		return $( '.ve-ui-toolbar-saveButton' );
	}

	get visualEditorSurface() {
		return $( '.ve-ui-surface-source' );
	}

	get codeMirrorTemplateFoldingButton() {
		return $( '.cm-tooltip-fold' );
	}

	get codeMirrorTemplateFoldingPlaceholder() {
		return $( '.cm-foldPlaceholder' );
	}

	async cursorToPosition( index ) {
		await this.clickText();

		// Second "Control" deactivates the modifier.
		const keys = [ 'Control', 'Home', 'Control' ];
		for ( let i = 0; i < index; i++ ) {
			keys.push( 'ArrowRight' );
		}
		await browser.keys( keys );
	}

	get highlightedBrackets() {
		return $$( '.CodeMirror-line .cm-mw-matchingbracket' );
	}

	async getHighlightedMatchingBrackets() {
		await this.highlightedBrackets[ 0 ].waitForDisplayed();
		const matchingTexts = await this.highlightedBrackets.map( ( el ) => el.getText() );
		return matchingTexts.join( '' );
	}
}

module.exports = new EditPage();
