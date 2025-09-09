const extensionJson = require( '../../extension.json' );
const mockBundle = require( '../../resources/lib/codemirror6.bundle.lib.js' );
jest.mock( 'ext.CodeMirror.v6.lib', () => mockBundle, { virtual: true } );
const mockCodeMirror = require( '../../resources/codemirror.js' );
jest.mock( 'ext.CodeMirror.v6', () => mockCodeMirror, { virtual: true } );
jest.mock( '../../resources/ext.CodeMirror.data.js', () => jest.fn(), { virtual: true } );
global.mw = require( '@wikimedia/mw-node-qunit/src/mockMediaWiki.js' )();
mw.user = Object.assign( mw.user, {
	options: {
		get: jest.fn().mockImplementation( ( key ) => {
			if ( key === 'codemirror-preferences' ) {
				return '{"bracketMatching":1,"lineWrapping":1,"activeLine":0,"specialChars":1,"bidiIsolation":1}';
			}
			// Only called for 'usecodemirror' option.
			return '1';
		} ),
		set: jest.fn()
	},
	sessionId: jest.fn().mockReturnValue( 'abc' ),
	getId: jest.fn().mockReturnValue( 123 ),
	isNamed: jest.fn().mockReturnValue( true )
} );
/**
 * Mock mw.config.get() to return the provided config,
 * merged into an abridged version of the actual config.
 *
 * @param {Object} config
 */
global.mockMwConfigGet = ( config = {} ) => {
	const mockConfig = Object.assign( {
		extCodeMirrorConfig: {
			urlProtocols: 'ftp://|https://|news:',
			defaultPreferences: extensionJson.config.CodeMirrorDefaultPreferences.value,
			primaryPreferences: extensionJson.config.CodeMirrorPrimaryPreferences.value,
			doubleUnderscore: [ {
				__notoc__: 'notoc'
			}, {} ],
			functionSynonyms: [ {
				'#ifexist': 'ifexist',
				'#invoke': 'invoke',
				'#lst': 'lst',
				'#special': 'special',
				filepath: 'filepath',
				int: 'int',
				ns: 'ns'
			}, {
				'!': '!',
				'מיון רגיל': 'defaultsort'
			} ],
			variableIDs: [
				'!'
			],
			redirection: [
				'#REDIRECT'
			],
			tags: {
				nowiki: true,
				indicator: true,
				ref: true,
				pre: true,
				references: true,
				templatestyles: true,
				// Made-up tag, for testing when a corresponding TagMode is not configured.
				myextension: true
			},
			tagModes: {
				ref: 'text/mediawiki',
				references: 'mediawiki'
			},
			imageKeywords: {
				$1px: 'width',
				'alt=$1': 'alt',
				'class=$1': 'class',
				left: 'left',
				'link=$1': 'link',
				sub: 'sub',
				thumb: 'thumbnail'
			}
		},
		wgMFMode: null,
		wgNamespaceIds: {
			file: 6
		},
		cmMode: 'mediawiki',
		cmLanguageVariants: [ 'en', 'en-x-piglatin' ]
	}, config );
	mw.config.get = jest.fn().mockImplementation( ( key ) => mockConfig[ key ] );
};
mockMwConfigGet();
mw.track = jest.fn();
mw.Api.prototype.saveOption = jest.fn();
mw.Api.prototype.loadMessagesIfMissing = jest.fn( () => {
	mw.messages = { values: require( '../../i18n/en.json' ) };
	mw.messages.get = jest.fn().mockReturnValue( mw.messages.values );
} );
mw.hook = jest.fn( ( name ) => ( {
	fire: jest.fn( ( ...args ) => {
		if ( mw.hook.mockHooks[ name ] ) {
			mw.hook.mockHooks[ name ].forEach( ( callback ) => callback( ...args ) );
		}
	} ),
	add: jest.fn( ( callback ) => {
		if ( !mw.hook.mockHooks[ name ] ) {
			mw.hook.mockHooks[ name ] = [];
		}
		mw.hook.mockHooks[ name ].push( callback );
	} ),
	remove: jest.fn( ( callback ) => {
		if ( mw.hook.mockHooks[ name ] ) {
			mw.hook.mockHooks[ name ] = mw.hook.mockHooks[ name ]
				.filter( ( cb ) => cb !== callback );
		}
	} ),
	deprecate: jest.fn()
} ) );
mw.storage = Object.create( null, {
	set: { value: jest.fn() },
	get: { value: jest.fn() },
	getObject: { value: jest.fn() },
	setObject: { value: jest.fn() }
} );
mw.hook.mockHooks = {};
global.$ = require( 'jquery' );
$.fn.textSelection = () => {};
$.client = {
	profile: jest.fn().mockReturnValue( {
		platform: 'linux'
	} )
};
window.matchMedia = jest.fn().mockReturnValue( {
	matches: false,
	addEventListener: jest.fn(),
	removeEventListener: jest.fn()
} );
mw.language.getDigitTransformTable = jest.fn().mockReturnValue( [] );
mw.log.warn = jest.fn().mockImplementation( ( ...args ) => {
	console.warn( ...args );
} );
global.CSS = {
	supports: ( css ) => /^\s*top\s*:\s*(?:inherit|initial)\s*$/i.test( css )
};

const listeners = [];
global.Worker = jest.fn().mockReturnValue( {
	postMessage( msg ) {
		self.onmessage?.( { data: msg } );
	},
	addEventListener( _, listener ) {
		listeners.push( listener );
	},
	removeEventListener( _, listener ) {
		listeners.splice( listeners.indexOf( listener ), 1 );
	}
} );
global.self = {};
global.postMessage = ( msg ) => {
	for ( const listener of listeners ) {
		listener( { data: msg } );
	}
};
