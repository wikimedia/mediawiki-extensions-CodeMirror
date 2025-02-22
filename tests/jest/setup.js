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
mw.config.get = jest.fn().mockReturnValue( '1000+ edits' );
mw.track = jest.fn();
mw.Api.prototype.saveOption = jest.fn();
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
	} )
} ) );
mw.storage = {
	set: jest.fn(),
	get: jest.fn(),
	getObject: jest.fn(),
	setObject: jest.fn()
};
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
