'use strict';

const BlankPage = require( 'wdio-mediawiki/BlankPage' );
const Util = require( 'wdio-mediawiki/Util' );

class UserPreferences {
	setPreferences( preferences ) {
		BlankPage.open();
		Util.waitForModuleState( 'mediawiki.base' );

		return browser.execute( function ( prefs ) {
			return mw.loader.using( 'mediawiki.api' ).then( function () {
				return new mw.Api().saveOptions( prefs );
			} );
		}, preferences );
	}

	enableWikitext2010EditorWithCodeMirror() {
		this.setPreferences( {
			usebetatoolbar: '1',
			usecodemirror: '1',
			'visualeditor-enable': '0',
			'visualeditor-newwikitext': '0'
		} );
	}

	enableWikitext2017EditorWithCodeMirror() {
		this.setPreferences( {
			usebetatoolbar: null,
			usecodemirror: '1',
			'visualeditor-enable': '1',
			'visualeditor-newwikitext': '1'
		} );
	}
}

module.exports = new UserPreferences();
