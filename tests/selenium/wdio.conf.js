import { config as wdioDefaults } from 'wdio-mediawiki/wdio-defaults.conf.js';

export const config = { ...wdioDefaults,
	// Override, or add to, the setting from wdio-mediawiki.
	// Learn more at https://webdriver.io/docs/configurationfile/
	//
	// Example:
	// logLevel: 'info',

	// Each test file creates its own user, so all specs can run in parallel
	// without preference conflicts between 2010 and 2017 editor tests.
	maxInstances: 4
};
