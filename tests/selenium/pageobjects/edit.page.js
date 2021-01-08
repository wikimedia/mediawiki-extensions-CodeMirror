'use strict';

const Page = require( 'wdio-mediawiki/Page' );

// Copied from mediawiki-core edit.page.js
class EditPage extends Page {
	openForEditing( title ) {
		super.openTitle( title, { action: 'edit', vehidebetadialog: 1, hidewelcomedialog: 1 } );
	}

	get legacyTextInput() { return $( '#wpTextbox1' ); }
	clickText() {
		if ( this.legacyTextInput.isDisplayed() ) {
			this.legacyTextInput.click();
		} else {
			// Click the container, if using WikiEditor etc.
			this.legacyTextInput.parentElement().click();
		}
	}

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
		const elements = $$( '.CodeMirror-line .CodeMirror-matchingbracket' );
		const matchingTexts = elements.map( function ( el ) {
			return el.getText();
		} );
		return matchingTexts.join( '' );
	}
}

module.exports = new EditPage();
