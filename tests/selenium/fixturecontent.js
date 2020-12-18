'use strict';

const Api = require( 'wdio-mediawiki/Api' );
const Util = require( 'wdio-mediawiki/Util' );

const fixture1 = '[]{{template}}';

class FixtureContent {
	/**
	 * Create a new fixture for testing syntax highlighting.
	 *
	 * @return {string} Page title
	 */
	createFixturePage() {
		const title = Util.getTestString( 'CodeMirror-fixture1-' );

		browser.call( () => Api.bot().then( ( bot ) => bot.edit( title, fixture1 ) ) );

		return title;
	}
}

module.exports = new FixtureContent();
