import { createApiClient } from 'wdio-mediawiki/Api.js';
import BlankPage from 'wdio-mediawiki/BlankPage.js';
import LoginPage from 'wdio-mediawiki/LoginPage.js';
import { getTestString, waitForModuleState } from 'wdio-mediawiki/Util.js';

class UserPreferences {
	async loginAsOther() {
		const username = getTestString( 'User-' );
		const password = getTestString();
		const apiClient = await createApiClient();
		await apiClient.createAccount( username, password );
		await LoginPage.login( username, password );
	}

	async setPreferences( preferences ) {
		await waitForModuleState( 'mediawiki.base' );

		return await browser.execute( ( prefs ) => mw.loader.using( 'mediawiki.api' ).then( () => new mw.Api().saveOptions( prefs ) ), preferences );
	}

	async enableWikitext2010EditorWithCodeMirror() {
		await BlankPage.open();
		await this.setPreferences( {
			usebetatoolbar: '1',
			usecodemirror: '1',
			'codemirror-preferences': '{"bracketMatching":1,"lineWrapping":1,"activeLine":0,"specialChars":1,"bidiIsolation":0}',
			'visualeditor-enable': '0',
			'visualeditor-newwikitext': '0'
		} );
	}

	async enableWikitext2017EditorWithCodeMirror( preferences = {} ) {
		await BlankPage.open();
		await this.setPreferences( Object.assign( {
			usebetatoolbar: '0',
			usecodemirror: '1',
			'codemirror-preferences': '{"bracketMatching":1,"lineWrapping":1,"activeLine":0,"specialChars":1,"bidiIsolation":0}',
			'visualeditor-enable': '1',
			'visualeditor-newwikitext': '1'
		}, preferences ) );
	}
}

export default new UserPreferences();
