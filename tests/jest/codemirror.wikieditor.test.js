const CodeMirrorWikiEditor = require( '../../resources/codemirror.wikieditor.js' );
const { mediawiki } = require( '../../resources/modes/mediawiki/codemirror.mediawiki.js' );
const { javascript } = require( '../../resources/modes/codemirror.mode.exporter.js' );

function getCodeMirrorWikiEditor( readOnly = false, langSupport = [] ) {
	const form = document.createElement( 'form' );
	const textarea = document.createElement( 'textarea' );
	textarea.readOnly = readOnly;
	form.appendChild( textarea );
	textarea.value = 'The Smashing Pumpkins';
	textarea.selectionStart = textarea.selectionEnd = 0;
	const cmWe = new CodeMirrorWikiEditor( textarea, langSupport );

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
		},
		$ui: $( '<div>' )
	} );

	return cmWe;
}

afterEach( () => {
	mw.hook.mockHooks = {};
	jest.restoreAllMocks();
	document.body.innerHTML = '';
} );

describe( 'initialize', () => {
	it( 'should add the button to the toolbar', () => {
		const cmWe = getCodeMirrorWikiEditor();
		cmWe.initialize();
		expect( cmWe.$textarea.wikiEditor ).toHaveBeenCalledWith(
			'addToToolbar',
			expect.objectContaining( {
				groups: { codemirror: expect.any( Object ) }
			} )
		);
	} );

	it( 'should add .ext-codemirror-readonly for readonly pages', () => {
		const cmWe = getCodeMirrorWikiEditor( true );
		cmWe.initialize();
		expect( cmWe.context.$ui[ 0 ].classList ).toContain( 'ext-codemirror-readonly' );
	} );

	it( 'should add a CSS class for the CodeMirror mode', () => {
		const cmWe = getCodeMirrorWikiEditor( false, javascript() );
		cmWe.initialize();
		expect( cmWe.context.$ui[ 0 ].classList ).toContain( 'ext-codemirror-javascript' );
		// Reset mock.
		mockMwConfigGet();
	} );
} );

describe( 'deactivate', () => {
	it( 'should remove the button from the toolbar', () => {
		const cmWe = getCodeMirrorWikiEditor();
		cmWe.initialize();
		cmWe.deactivate();

		expect( cmWe.$textarea.wikiEditor ).toHaveBeenCalledWith(
			'removeFromToolbar',
			expect.objectContaining( {
				section: 'advanced',
				group: 'codemirror'
			} )
		);
	} );

	it( 'should remove buttons from the toolbar for non-wikitext', () => {
		const cmWe = getCodeMirrorWikiEditor( false, javascript() );
		cmWe.initialize();
		cmWe.deactivate();

		expect( cmWe.$textarea.wikiEditor ).toHaveBeenCalledWith(
			'removeFromToolbar',
			expect.objectContaining( {
				section: 'secondary',
				group: 'codemirror'
			} )
		);
		expect( cmWe.$textarea.wikiEditor ).toHaveBeenCalledWith(
			'removeFromToolbar',
			expect.objectContaining( {
				section: 'main',
				group: 'codemirror-format'
			} )
		);
		expect( cmWe.$textarea.wikiEditor ).toHaveBeenCalledWith(
			'removeFromToolbar',
			expect.objectContaining( {
				section: 'main',
				group: 'codemirror-preferences'
			} )
		);
		expect( cmWe.$textarea.wikiEditor ).toHaveBeenCalledWith(
			'removeFromToolbar',
			expect.objectContaining( {
				section: 'main',
				group: 'codemirror-search'
			} )
		);

		// Reset mock.
		mockMwConfigGet();
	} );
} );

describe( 'destroy', () => {
	it( 'should remove the button from the toolbar', () => {
		const cmWe = getCodeMirrorWikiEditor();
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

	it( 'should remove .ext-codemirror-readonly on read-only pages', () => {
		const cmWe = getCodeMirrorWikiEditor( true );
		cmWe.initialize();
		expect( cmWe.context.$ui[ 0 ].classList ).toContain( 'ext-codemirror-readonly' );
		cmWe.destroy();
		expect( cmWe.context.$ui[ 0 ].classList ).not.toContain( 'ext-codemirror-readonly' );
	} );
} );

describe( 'Hook handlers and event listeners', () => {
	it( 'should remove submit event listener when CodeMirror is off', () => {
		const cmWe = getCodeMirrorWikiEditor();
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
		const cmWe = getCodeMirrorWikiEditor();
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
		const cmWe = getCodeMirrorWikiEditor();
		cmWe.initialize();
		expect( mw.hook.mockHooks[ 'ext.CodeMirror.switch' ].length ).toBe( 1 );
		expect( count ).toBe( 1 );
		cmWe.toggle();
		expect( mw.hook.mockHooks[ 'ext.CodeMirror.switch' ].length ).toBe( 1 );
		expect( count ).toBe( 2 );
	} );

	it( 'only 1 ext.CodeMirror.ready hook handler', () => {
		[ ...Array( 3 ) ].forEach( () => mediawiki() );
		expect( mw.hook.mockHooks[ 'ext.CodeMirror.ready' ].length ).toBe( 1 );
	} );
} );

describe( 'logEditFeature', () => {
	it( 'should log when activating and deactivating', () => {
		const cmWe = getCodeMirrorWikiEditor();
		const spy = jest.spyOn( cmWe, 'logEditFeature' );
		cmWe.initialize();
		expect( spy ).toHaveBeenCalledTimes( 1 );
		expect( spy ).toHaveBeenCalledWith( 'activated' );
		expect( mw.track ).toHaveBeenCalledWith( 'visualEditorFeatureUse', {
			action: 'activated',
			feature: 'codemirror',
			// eslint-disable-next-line camelcase
			editor_interface: 'wikitext',
			platform: 'desktop',
			integration: 'page'
		} );
		cmWe.deactivate();
		expect( spy ).toHaveBeenCalledTimes( 2 );
		expect( spy ).toHaveBeenCalledWith( 'deactivated' );
		expect( mw.track ).toHaveBeenCalledWith( 'visualEditorFeatureUse', {
			action: 'deactivated',
			feature: 'codemirror',
			// eslint-disable-next-line camelcase
			editor_interface: 'wikitext',
			platform: 'desktop',
			integration: 'page'
		} );
	} );

	it( 'should show a Preferences button in the advanced section of the toolbar', () => {
		const cmWe = getCodeMirrorWikiEditor();
		cmWe.initialize();

		expect( cmWe.$textarea.wikiEditor ).toHaveBeenCalledWith(
			'addToToolbar',
			expect.objectContaining( {
				section: 'advanced',
				groups: { codemirror: { tools: { CodeMirrorPreferences: expect.any( Object ) } } }
			} )
		);
	} );

	it( 'should only log when preferences are not the same as the default', () => {
		const cmWe = getCodeMirrorWikiEditor( false, mediawiki() );
		cmWe.initialize();
		const spy = jest.spyOn( cmWe, 'logEditFeature' );
		// There should be no logging since we're using the default preferences.
		expect( spy ).not.toHaveBeenCalledWith( 'prefs-bracketMatching' );
		// Enable activeLine and assert that it was logged.
		cmWe.preferences.setPreference( 'activeLine', true );
		expect( spy ).toHaveBeenCalledWith( 'prefs-activeLine' );
		expect( mw.track ).toHaveBeenCalledWith( 'visualEditorFeatureUse', {
			action: 'prefs-activeLine',
			feature: 'codemirror',
			// eslint-disable-next-line camelcase
			editor_interface: 'wikitext',
			platform: 'desktop',
			integration: 'page'
		} );
		// Re-call the extension getter to verify *all* enabled extensions are logged.
		// eslint-disable-next-line no-unused-expressions
		cmWe.preferences.extension;
		expect( spy ).toHaveBeenNthCalledWith( 2, 'prefs-autofocus' );
		expect( spy ).toHaveBeenNthCalledWith( 3, 'prefs-bracketMatching' );
		expect( spy ).toHaveBeenNthCalledWith( 4, 'prefs-lineNumbering' );
		expect( spy ).toHaveBeenNthCalledWith( 5, 'prefs-lineWrapping' );
		expect( spy ).toHaveBeenNthCalledWith( 6, 'prefs-activeLine' );
		expect( spy ).toHaveBeenNthCalledWith( 7, 'prefs-specialChars' );
		// Other extensions are not used here because we aren't using the mediawiki language.
	} );

	it( 'should log when opening the preferences panel', () => {
		const cmWe = getCodeMirrorWikiEditor();
		cmWe.initialize();
		const spy = jest.spyOn( cmWe, 'logEditFeature' );
		cmWe.preferences.toggle( cmWe.view, true );
		expect( spy ).toHaveBeenCalledWith( 'prefs-display' );
	} );

	it( 'should log when opening the search panel', () => {
		const cmWe = getCodeMirrorWikiEditor();
		cmWe.initialize();
		const spy = jest.spyOn( cmWe, 'logEditFeature' );
		cmWe.view.contentDOM.dispatchEvent(
			new KeyboardEvent( 'keydown', { key: 'f', ctrlKey: true } )
		);
		expect( spy ).toHaveBeenCalledWith( 'search' );
		expect( mw.track ).toHaveBeenCalledWith( 'visualEditorFeatureUse', {
			action: 'search',
			feature: 'codemirror',
			// eslint-disable-next-line camelcase
			editor_interface: 'wikitext',
			platform: 'desktop',
			integration: 'page'
		} );
	} );
} );

describe( 'addCodeFormattingButtonsToToolbar', () => {
	it( 'should add the expected tool groups and buttons for non-wikitext', () => {
		const cmWe = getCodeMirrorWikiEditor( false, javascript() );
		cmWe.initialize();
		expect( cmWe.$textarea.wikiEditor ).toHaveBeenCalledWith(
			'addToToolbar',
			expect.objectContaining( {
				groups: {
					'codemirror-format': {
						tools: {
							indentMore: expect.any( Object ),
							indentLess: expect.any( Object )
						}
					},
					'codemirror-preferences': {
						tools: {
							whitespace: expect.any( Object ),
							lineWrapping: expect.any( Object ),
							autocomplete: expect.any( Object )
						}
					},
					'codemirror-search': {
						tools: {
							gotoLine: expect.any( Object ),
							search: expect.any( Object )
						}
					}
				}
			} )
		);
		mockMwConfigGet();
	} );
} );

describe( 'getTool / getToggleToolPref', () => {
	it( 'getTool', () => {
		const command = jest.fn();
		const cmWe = getCodeMirrorWikiEditor();
		expect( cmWe.getTool( 'fooBar', command ) ).toStrictEqual( {
			label: 'codemirror-keymap-foobar',
			type: 'button',
			oouiIcon: 'fooBar',
			action: {
				type: 'callback',
				execute: command
			}
		} );
		expect( cmWe.getTool( 'fooBar', command, { key: 'Ctrl-X' } ) ).toStrictEqual( {
			label: 'codemirror-keymap-foobarword-separatorbrackets',
			type: 'button',
			oouiIcon: 'fooBar',
			action: {
				type: 'callback',
				execute: command
			}
		} );
	} );

	it( 'getToggleToolPref', () => {
		const cmWe = getCodeMirrorWikiEditor();
		expect( cmWe.getToggleToolPref( 'fooBar', 'fooBarIcon' ) ).toMatchObject( {
			label: 'codemirror-prefs-foobar',
			type: 'element',
			element: expect.any( Function )
		} );
	} );
} );
