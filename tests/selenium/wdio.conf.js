'use strict';

const { config } = require( 'wdio-mediawiki/wdio-defaults.conf.js' );

exports.config = { ...config,
	// Override, or add to, the setting from wdio-mediawiki.
	// Learn more at https://webdriver.io/docs/configurationfile/
	//
	// Example:
	// logLevel: 'info',

	// Group tests by editor type to avoid conflicts from parallel tests
	// setting different user preferences (2010 vs 2017 editor).
	// Run with: npm run selenium-test -- --suite editor2010
	// Or run all suites sequentially with: npm run selenium-test
	suites: {
		editor2010: [
			'./specs/*-wikitext2010.js'
		],
		editor2017: [
			'./specs/*-wikitext2017.js'
		]
	},

	// Allow parallel execution within each suite
	maxInstances: 2
};
