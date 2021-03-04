'use strict';

const Page = require( 'wdio-mediawiki/Page' );

// Copied from mediawiki-core edit.page.js
class EditPage extends Page {
	openForEditing( title ) {
		super.openTitle( title, { action: 'edit', vehidebetadialog: 1, hidewelcomedialog: 1 } );
	}

	get wikiEditorToolbar() { return $( '#wikiEditor-ui-toolbar' ); }
	get legacyTextInput() { return $( '#wpTextbox1' ); }
	clickText() {
		if ( this.visualEditorSave.isDisplayed() ) {
			this.visualEditorSurface.click();
		} else if ( this.legacyTextInput.isDisplayed() ) {
			this.legacyTextInput.click();
		} else {
			// Click the container, if using WikiEditor etc.
			this.legacyTextInput.parentElement().click();
		}
	}

	get visualEditorSave() { return $( '.ve-ui-toolbar-saveButton' ); }
	get visualEditorToggle() { return $( '.ve-init-mw-editSwitch' ); }
	get visualEditorSurface() { return $( '.ve-ui-surface-source' ); }

	cursorToPosition( index ) {
		this.clickText();

		// Second "Control" deactivates the modifier.
		const keys = [ 'Control', 'Home', 'Control' ];
		for ( let i = 0; i < index; i++ ) {
			keys.push( 'ArrowRight' );
		}
		browser.keys( keys );
	}

	getHighlightedMatchingBrackets() {
		const elements = $$( '.CodeMirror-line .cm-mw-matchingbracket' );
		const matchingTexts = elements.map( function ( el ) {
			return el.getText();
		} );
		return matchingTexts.join( '' );
	}
}

module.exports = new EditPage();
