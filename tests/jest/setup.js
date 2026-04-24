const extensionJson = require( '../../extension.json' );
const mockBundle = require( '../../resources/lib/codemirror.bundle.lib.js' );
jest.mock( 'ext.CodeMirror.lib', () => mockBundle, { virtual: true } );
const mockCodeMirror = require( '../../resources/codemirror.js' );
jest.mock( 'ext.CodeMirror', () => mockCodeMirror, { virtual: true } );
jest.mock( '../../resources/ext.CodeMirror.data.js', () => jest.fn(), { virtual: true } );
global.mw = require( '@wikimedia/mw-node-qunit/src/mockMediaWiki.js' )();
mw.user = Object.assign( mw.user, {
	options: {
		get: jest.fn().mockImplementation( ( key ) => {
			switch ( key ) {
				case 'codemirror-preferences':
				case 'codemirror-preferences-code':
					// Use default preferences.
					return null;
				case 'usecodemirror':
				case 'usecodemirror-code':
					return '1';
				case 'usecodemirror-colorblind':
					return '0';
				case 'editfont':
					return 'monospace';
				default:
					mw.log.warn( `Unmocked mw.user.options.get() for key: ${ key }` );
					return null;
			}
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
			defaultPreferencesCode: extensionJson.config.CodeMirrorDefaultPreferencesCode.value,
			primaryPreferences: extensionJson.config.CodeMirrorPrimaryPreferences.value,
			doubleUnderscore: [ {
				__notoc__: 'notoc'
			}, {} ],
			subst: {
				'SUBST:': 'subst',
				'SAFESUBST:': 'safesubst'
			},
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
				gallery: true,
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
		cmLanguageVariants: [ 'en', 'en-x-piglatin' ],
		hasGlobalPreferences: false
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
mw.Api.prototype.get = jest.fn().mockReturnValue( Promise.resolve( {} ) );
mw.Api.prototype.post = jest.fn().mockReturnValue( Promise.resolve( {} ) );
mw.Api.prototype.postWithToken = jest.fn().mockReturnValue( Promise.resolve( {} ) );
mw.Api.prototype.abort = jest.fn();
mw.Rest = jest.fn().mockImplementation( () => ( {} ) );
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
mw.loader = Object.assign( mw.loader, {
	getState: jest.fn()
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
mw.log = jest.fn();
mw.log.warn = jest.fn().mockImplementation( ( ...args ) => {
	console.warn( ...args );
} );
global.CSS = {
	supports: ( css ) => /^\s*top\s*:\s*(?:inherit|initial)\s*$/i.test( css )
};
global.OO = {
	ui: {
		ToggleButtonWidget: jest.fn().mockReturnValue( {
			on: jest.fn(),
			$element: $( '<button>' ),
			setValue: jest.fn()
		} )
	}
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
Range.prototype.getClientRects = jest.fn().mockReturnValue( [] );
