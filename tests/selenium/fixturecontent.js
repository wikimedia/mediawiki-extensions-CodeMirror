import { createApiClient } from 'wdio-mediawiki/Api.js';

const fixture1 = '[]{{template}}';

class FixtureContent {
	/**
	 * Create a new fixture for testing syntax highlighting.
	 *
	 * @param {string} title
	 */
	async createFixturePage( title ) {
		const apiClient = await createApiClient();
		await apiClient.edit( title, fixture1 );
	}
}

export default new FixtureContent();
