'use strict';

const Api = require( 'wdio-mediawiki/Api' );

const fixture1 = '[]{{template}}';

class FixtureContent {
	/**
	 * Create a new fixture for testing syntax highlighting.
	 *
	 * @param {string} title
	 */
	async createFixturePage( title ) {
		const bot = await Api.bot();
		await bot.edit( title, fixture1 );
	}
}

module.exports = new FixtureContent();
