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

describe( 'logEditFeature', () => {
	afterEach( jest.restoreAllMocks );

	it( 'should log when activating and deactivating', () => {
		const spy = jest.spyOn( cmWe, 'logEditFeature' );
		cmWe.initialize();
		expect( spy ).toHaveBeenCalledTimes( 1 );
		expect( spy ).toHaveBeenCalledWith( 'activated' );
		expect( mw.track ).toBeCalledWith( 'visualEditorFeatureUse', {
			action: 'activated',
			feature: 'codemirror'
		} );
		cmWe.deactivate();
		expect( spy ).toHaveBeenCalledTimes( 2 );
		expect( spy ).toHaveBeenCalledWith( 'deactivated' );
		expect( mw.track ).toBeCalledWith( 'visualEditorFeatureUse', {
			action: 'deactivated',
			feature: 'codemirror'
		} );
	} );

	it( 'should log when preferred extensions are enabled or disabled', () => {
		cmWe.initialize();
		const spy = jest.spyOn( cmWe, 'logEditFeature' );
		cmWe.preferences.registerExtension( 'autocomplete', [], cmWe.view );
		expect( spy ).toHaveBeenCalledWith( 'prefs-autocomplete' );
		expect( mw.track ).toBeCalledWith( 'visualEditorFeatureUse', {
			action: 'prefs-autocomplete',
			feature: 'codemirror'
		} );
		cmWe.preferences.setPreference( 'bracketMatching', true );
		expect( spy ).toHaveBeenCalledWith( 'prefs-bracketMatching' );
		expect( spy ).toHaveBeenCalledTimes( 2 );
		expect( mw.track ).toBeCalledWith( 'visualEditorFeatureUse', {
			action: 'prefs-bracketMatching',
			feature: 'codemirror'
		} );
		// Show preferences panel
		cmWe.preferences.toggle( cmWe.view, true );
		expect( spy ).toHaveBeenCalledWith( 'prefs-display' );
	} );

	it( 'should log when opening the search panel', () => {
		cmWe.initialize();
		const spy = jest.spyOn( cmWe, 'logEditFeature' );
		cmWe.view.contentDOM.dispatchEvent(
			new KeyboardEvent( 'keydown', { key: 'f', ctrlKey: true } )
		);
		expect( spy ).toHaveBeenCalledWith( 'search' );
		expect( mw.track ).toBeCalledWith( 'visualEditorFeatureUse', {
			action: 'search',
			feature: 'codemirror'
		} );
	} );
} );
