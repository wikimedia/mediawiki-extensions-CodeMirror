const CodeMirrorWikiEditor = require( '../../resources/codemirror.wikieditor.js' );
const mediaWikiLang = require( '../../resources/codemirror.mediawiki.js' );

let cmWe;

beforeEach( () => {
	mw.hook.mockHooks = {};
	const form = document.createElement( 'form' );
	const textarea = document.createElement( 'textarea' );
	form.appendChild( textarea );
	textarea.value = 'The Smashing Pumpkins';
	textarea.selectionStart = textarea.selectionEnd = 0;
	cmWe = new CodeMirrorWikiEditor( textarea );

	// Simulate the button that enables/disables CodeMirror as WikiEditor doesn't exist here.
	cmWe.$textarea.wikiEditor = jest.fn();
	const toolbar = document.createElement( 'div' );
	toolbar.className = 'wikiEditor-ui-toolbar';
	const div = document.createElement( 'div' );
	div.setAttribute( 'rel', 'CodeMirror' );
	div.className = 'tool tool-element';
	const btn = document.createElement( 'span' );
	btn.className = 'tool cm-mw-toggle-wikieditor';
	div.appendChild( btn );
	toolbar.appendChild( div );
	document.body.appendChild( toolbar );

	// Add WikiEditor context to the textarea.
	cmWe.$textarea.data = jest.fn().mockReturnValue( {
		modules: {
			toolbar: {
				$toolbar: $( toolbar )
			}
		}
	} );
} );

describe( 'initialize', () => {
	it( 'should add the button to the toolbar', () => {
		cmWe.initialize();

		expect( cmWe.$textarea.wikiEditor ).toHaveBeenCalledWith(
			'addToToolbar',
			expect.objectContaining( {
				groups: { codemirror: expect.any( Object ) }
			} )
		);
	} );
} );

describe( 'destroy', () => {
	it( 'should remove the button from the toolbar', () => {
		cmWe.initialize();
		cmWe.destroy();

		expect( cmWe.$textarea.wikiEditor ).toHaveBeenCalledWith(
			'removeFromToolbar',
			expect.objectContaining( {
				section: 'main',
				group: 'codemirror'
			} )
		);
	} );
} );

describe( 'Hook handlers and event listeners', () => {
	it( 'should remove submit event listener when CodeMirror is off', () => {
		cmWe.initialize();
		expect( cmWe.view ).not.toBeNull();
		expect( cmWe.state ).not.toBeNull();
		expect( mw.hook.mockHooks[ 'ext.WikiEditor.realtimepreview.enable' ].length ).toBe( 1 );
		expect( mw.hook.mockHooks[ 'ext.WikiEditor.realtimepreview.disable' ].length ).toBe( 1 );
		cmWe.toggle();
		expect( mw.hook.mockHooks[ 'ext.WikiEditor.realtimepreview.enable' ].length ).toBe( 0 );
		expect( mw.hook.mockHooks[ 'ext.WikiEditor.realtimepreview.disable' ].length ).toBe( 0 );
	} );

	it( 'should remove realtime preview hook handler when CodeMirror is off', () => {
		cmWe.initialize();
		expect( cmWe.view ).not.toBeNull();
		expect( cmWe.state ).not.toBeNull();
		expect( mw.hook.mockHooks[ 'ext.WikiEditor.realtimepreview.enable' ].length ).toBe( 1 );
		expect( mw.hook.mockHooks[ 'ext.WikiEditor.realtimepreview.disable' ].length ).toBe( 1 );
		cmWe.toggle();
		expect( mw.hook.mockHooks[ 'ext.WikiEditor.realtimepreview.enable' ].length ).toBe( 0 );
		expect( mw.hook.mockHooks[ 'ext.WikiEditor.realtimepreview.disable' ].length ).toBe( 0 );
	} );

	it( 'should fire ext.CodeMirror.switch only once per toggle', () => {
		let count = 0;
		mw.hook( 'ext.CodeMirror.switch' ).add( () => {
			count++;
		} );
		cmWe.initialize();
		expect( mw.hook.mockHooks[ 'ext.CodeMirror.switch' ].length ).toBe( 1 );
		expect( count ).toBe( 1 );
		cmWe.toggle();
		expect( mw.hook.mockHooks[ 'ext.CodeMirror.switch' ].length ).toBe( 1 );
		expect( count ).toBe( 2 );
	} );

	it( 'only 1 ext.CodeMirror.ready hook handler', () => {
		[ ...Array( 3 ) ].forEach( () => mediaWikiLang() );
		expect( mw.hook.mockHooks[ 'ext.CodeMirror.ready' ].length ).toBe( 1 );
	} );
} );
