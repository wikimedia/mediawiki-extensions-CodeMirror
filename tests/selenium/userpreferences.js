'use strict';

const Api = require( 'wdio-mediawiki/Api' ),
	BlankPage = require( 'wdio-mediawiki/BlankPage' ),
	LoginPage = require( 'wdio-mediawiki/LoginPage' ),
	Util = require( 'wdio-mediawiki/Util' );

class UserPreferences {
	async loginAsOther() {
		const username = Util.getTestString( 'User-' );
		const password = Util.getTestString();
		await Api.createAccount( await Api.bot(), username, password );
		await LoginPage.login( username, password );
	}

	async setPreferences( preferences ) {
		await BlankPage.open();
		Util.waitForModuleState( 'mediawiki.base' );

		return await browser.execute( ( prefs ) => mw.loader.using( 'mediawiki.api' ).then( () => new mw.Api().saveOptions( prefs ) ), preferences );
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
