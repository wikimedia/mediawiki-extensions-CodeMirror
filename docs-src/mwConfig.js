'use strict';

// The parser tests run without language variants, but the page shows conversion markup.
module.exports = Object.assign( {}, require( '../tests/jest/fixtures/mwConfig.json' ), {
	languageVariants: [ 'zh-hans', 'zh-hant', 'zh-cn', 'zh-tw', 'zh-hk', 'zh-mo', 'zh-my', 'zh-sg' ]
} );
