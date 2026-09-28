/**
 * Minimal stand-ins for the MediaWiki globals the wikitext mode reads.
 *
 * The mode's module graph touches these while loading, so this file must run before it is
 * required: codemirror.mediawiki.js reads wgNamespaceIds, codemirror.mediawiki.lint.js calls
 * mw.loader.getState(), and codemirror.mediawiki.openLinks.js calls $.client.profile().
 * The rest is only reached by extensions this page does not enable.
 */

/* eslint-disable camelcase */
const namespaceIds = {
	media: -2,
	special: -1,
	'': 0,
	talk: 1,
	user: 2,
	user_talk: 3,
	project: 4,
	project_talk: 5,
	file: 6,
	file_talk: 7,
	mediawiki: 8,
	mediawiki_talk: 9,
	template: 10,
	template_talk: 11,
	help: 12,
	help_talk: 13,
	category: 14,
	category_talk: 15,
	image: 6,
	image_talk: 7,
	module: 828,
	module_talk: 829
};
/* eslint-enable camelcase */

const config = {
	wgNamespaceIds: namespaceIds,
	wgPageName: 'Help:CodeMirror',
	cmLanguageVariants: {}
};

const noop = () => {};
const resolved = () => Promise.resolve( {} );

window.mw = {
	config: {
		get: ( name, fallback ) => ( name in config ? config[ name ] : fallback )
	},
	loader: {
		getState: () => null,
		using: () => Promise.resolve()
	},
	messages: {
		exists: () => false,
		get: () => ( {} )
	},
	hook: () => ( { add: noop, fire: noop } ),
	log: { warn: noop, error: noop },
	msg: ( key ) => key,
	Api: function () {
		return { get: resolved, post: resolved, loadMessagesIfMissing: resolved };
	},
	Rest: function () {
		return { get: resolved, post: resolved };
	},
	Title: function ( title ) {
		return { getPrefixedText: () => title };
	}
};
window.mw.Title.newFromText = ( title ) => new window.mw.Title( title );

window.$ = {
	client: {
		profile: () => ( { platform: 'linux' } )
	}
};
