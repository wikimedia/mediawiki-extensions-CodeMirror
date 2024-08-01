const mockBundle = require( '../../resources/lib/codemirror6.bundle.dist.js' );
jest.mock( 'ext.CodeMirror.v6.lib', () => mockBundle, { virtual: true } );
const mockCodeMirror = require( '../../resources/codemirror.js' );
jest.mock( 'ext.CodeMirror.v6', () => mockCodeMirror, { virtual: true } );
jest.mock( '../../resources/ext.CodeMirror.data.js', () => jest.fn(), { virtual: true } );
global.mw = require( '@wikimedia/mw-node-qunit/src/mockMediaWiki.js' )();
mw.user = Object.assign( mw.user, {
	options: {
		// Only called for 'usecodemirror' option.
		get: jest.fn().mockReturnValue( 1 ),
		set: jest.fn()
	},
	sessionId: jest.fn().mockReturnValue( 'abc' ),
	getId: jest.fn().mockReturnValue( 123 ),
	isNamed: jest.fn().mockReturnValue( true )
} );
mw.config.get = jest.fn().mockReturnValue( '1000+ edits' );
mw.track = jest.fn();
mw.Api.prototype.saveOption = jest.fn();
global.$ = require( 'jquery' );
$.fn.textSelection = () => {};
window.matchMedia = jest.fn().mockReturnValue( { matches: false } );
