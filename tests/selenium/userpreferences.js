'use strict';

const BlankPage = require( 'wdio-mediawiki/BlankPage' ),
	Util = require( 'wdio-mediawiki/Util' );

class UserPreferences {
	async setPreferences( preferences ) {
		await BlankPage.open();
		Util.waitForModuleState( 'mediawiki.base' );

		return await browser.execute( function ( prefs ) {
			return mw.loader.using( 'mediawiki.api' ).then( function () {
				return new mw.Api().saveOptions( prefs );
			} );
		}, preferences );
	}

	async enableWikitext2010EditorWithCodeMirror() {
		await this.setPreferences( {
			usebetatoolbar: '1',
			usecodemirror: '1',
			'visualeditor-enable': '0',
			'visualeditor-newwikitext': '0'
		} );
	}

	async enableWikitext2017EditorWithCodeMirror() {
		await this.setPreferences( {
			usebetatoolbar: null,
			usecodemirror: '1',
			'visualeditor-enable': '1',
			'visualeditor-newwikitext': '1'
		} );
	}
}

module.exports = new UserPreferences();
