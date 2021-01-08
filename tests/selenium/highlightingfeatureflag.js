'use strict';

// Temporary, can be removed along with the feature flag.

class HighlightingFeatureFlag {
	enable() {
		browser.setCookies( {
			name: 'mw-codemirror-bracket-matching-test',
			value: '1'
		} );
	}
}

module.exports = new HighlightingFeatureFlag();
