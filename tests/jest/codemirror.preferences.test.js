/* eslint-disable-next-line n/no-missing-require */
const { EditorView } = require( 'ext.CodeMirror.lib' );
const CodeMirrorPreferences = require( '../../resources/codemirror.preferences.js' );
const CodeMirrorKeymap = require( '../../resources/codemirror.keymap.js' );
const CodeMirrorExtensionRegistry = require( '../../resources/codemirror.extensionRegistry.js' );

const preferenceModeIds = mw.config.get( 'extCodeMirrorConfig' ).preferenceModeIds;
const { ENABLED, DISABLED, MEDIAWIKI_ONLY, NON_MEDIAWIKI_ONLY } = preferenceModeIds;

describe( 'CodeMirrorPreferences', () => {
	let mockDefaultPreferences, mockUserPreferences, getCodeMirrorPreferences;

	beforeEach( () => {
		mockDefaultPreferences = (
			defaultPreferences = { fooExtension: DISABLED, barExtension: ENABLED },
			primaryPreferences = { fooExtension: true, barExtension: true }
		) => {
			mw.config.get = jest.fn().mockReturnValue( {
				defaultPreferences,
				primaryPreferences,
				preferenceModeIds
			} );
		};
		mockUserPreferences = ( preferences = {} ) => {
			mw.user.options.get = jest.fn().mockReturnValue( JSON.stringify( preferences ) );
		};
		getCodeMirrorPreferences = (
			extConfig = {
				fooExtension: EditorView.theme(),
				barExtension: EditorView.theme()
			},
			mode = 'mediawiki',
			isVisualEditor = false
		) => new CodeMirrorPreferences(
			new CodeMirrorExtensionRegistry( extConfig, isVisualEditor ),
			mode,
			new CodeMirrorKeymap(),
			isVisualEditor
		);

		mw.user.isNamed = jest.fn().mockReturnValue( true );
	} );

	afterEach( () => {
		mw.hook.mockHooks = {};
	} );

	it( 'defaultPreferences', () => {
		mockDefaultPreferences();
		const preferences = getCodeMirrorPreferences();
		expect( preferences.getDefaultPreferences() ).toStrictEqual( {
			fooExtension: false,
			barExtension: true
		} );
	} );

	it( 'fetchPreferences', () => {
		mockDefaultPreferences();
		mockUserPreferences( { fooExtension: ENABLED } );
		const preferences = getCodeMirrorPreferences();
		expect( preferences.fetchPreferences() ).toStrictEqual( {
			fooExtension: true,
			barExtension: true
		} );
	} );

	it( 'setPreference', () => {
		mockDefaultPreferences();
		mockUserPreferences( { fooExtension: DISABLED } );
		const preferences = getCodeMirrorPreferences();
		preferences.setPreference( 'fooExtension', true );
		expect( preferences.preferences.fooExtension ).toStrictEqual( true );
		expect( mw.user.options.set ).toHaveBeenCalledWith( 'codemirror-preferences', '{"fooExtension":2}' );
		expect( mw.Api.prototype.saveOption ).toHaveBeenCalledWith( 'codemirror-preferences', '{"fooExtension":2}' );
		// Set again, and verify we do not call saveOption again.
		preferences.setPreference( 'fooExtension', true );
		expect( mw.Api.prototype.saveOption ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'setPreference (from MEDIAWIKI_ONLY)', () => {
		mockDefaultPreferences();
		mockUserPreferences( { fooExtension: MEDIAWIKI_ONLY } );
		const preferences = getCodeMirrorPreferences( {
			fooExtension: EditorView.theme()
		}, 'css' );
		preferences.setPreference( 'fooExtension', true );
		expect( preferences.preferences.fooExtension ).toStrictEqual( true );
		expect( mw.user.options.set ).toHaveBeenCalledWith( 'codemirror-preferences', '{"fooExtension":1}' );
		expect( mw.Api.prototype.saveOption ).toHaveBeenCalledWith( 'codemirror-preferences', '{"fooExtension":1}' );
	} );

	it( 'getPreference', () => {
		mockDefaultPreferences();
		mockUserPreferences( { barExtension: DISABLED } );
		const preferences = getCodeMirrorPreferences();
		expect( preferences.getPreference( 'fooExtension' ) ).toStrictEqual( false );
		expect( preferences.getPreference( 'barExtension' ) ).toStrictEqual( false );
	} );

	it( 'getPreference (VisualEditor)', () => {
		mockDefaultPreferences( { fooExtension: ENABLED, bracketMatching: DISABLED } );
		mockUserPreferences( { bracketMatching: 1 } );
		const preferences = getCodeMirrorPreferences( {
			fooExtension: EditorView.theme(),
			bracketMatching: EditorView.theme()
		}, 'mediawiki', true );
		expect( preferences.getPreference( 'bracketMatching' ) ).toBeFalsy();
	} );

	it( 'hasNonDefaultPreferences', () => {
		mockDefaultPreferences();
		mockUserPreferences( null );
		expect( getCodeMirrorPreferences().hasNonDefaultPreferences() ).toBeFalsy();
		mockUserPreferences( { fooExtension: 1 } );
		const preferences = getCodeMirrorPreferences();
		expect( preferences.hasNonDefaultPreferences() ).toBeTruthy();
		preferences.setPreference( 'fooExtension', false );
		expect( preferences.hasNonDefaultPreferences() ).toBeFalsy();
	} );

	it( 'registerExtension', () => {
		mockDefaultPreferences();
		mockUserPreferences( { bazExtension: ENABLED } );
		const bazExtension = EditorView.theme();
		const preferences = getCodeMirrorPreferences();
		const view = new EditorView();
		preferences.registerExtension( 'bazExtension', bazExtension, view );
		// HACK: Tests against CompartmentInstance `#inner` property to get the Extension instance.
		expect( preferences.extensionRegistry.get( 'bazExtension' ).inner ).toBe( bazExtension );
		expect( preferences.extensionRegistry.isRegistered( 'bazExtension', view ) ).toBeTruthy();
	} );

	it( 'toggleExtension', () => {
		mockDefaultPreferences();
		mockUserPreferences( { fooExtension: ENABLED, barExtension: ENABLED } );
		const preferences = getCodeMirrorPreferences();
		const view = new EditorView();
		preferences.registerExtension( 'fooExtension', EditorView.theme(), view );
		preferences.registerExtension( 'barExtension', EditorView.theme(), view );
		preferences.toggleExtension( 'fooExtension', view );
		expect( preferences.extensionRegistry.isEnabled( 'fooExtension', view ) ).toBeFalsy();
		expect( preferences.extensionRegistry.isEnabled( 'barExtension', view ) ).toBeTruthy();
		preferences.toggleExtension( 'barExtension', view );
		expect( preferences.extensionRegistry.isEnabled( 'barExtension', view ) ).toBeFalsy();
	} );

	it( 'extension', () => {
		mockUserPreferences( { fooExtension: ENABLED, barExtension: ENABLED } );
		const preferences = getCodeMirrorPreferences( { fooExtension: 1, barExtension: 1 } );
		const hookSpy = jest.spyOn( preferences, 'firePreferencesApplyHook' );
		const ext = preferences.extension;
		expect( ext[ 0 ].constructor.name ).toStrictEqual( 'FacetProvider' );
		// fooExtension and barExtension
		expect( ext[ 1 ].length ).toStrictEqual( 2 );
		expect( hookSpy ).toHaveBeenCalledTimes( 2 );
	} );

	it( 'panel', () => {
		mockDefaultPreferences();
		mockUserPreferences(
			{ fooExtension: ENABLED, barExtension: DISABLED, inapplicableExtension: ENABLED }
		);
		const preferences = getCodeMirrorPreferences();
		const panel = preferences.panel;
		expect( panel.dom.className ).toStrictEqual( 'cm-mw-preferences-panel cm-mw-panel' );
		const checkboxes = panel.dom.querySelectorAll( '.cdx-checkbox__input' );
		expect( checkboxes.length ).toStrictEqual( 2 );
		expect( checkboxes[ 0 ].name ).toStrictEqual( 'fooExtension' );
		expect( checkboxes[ 1 ].name ).toStrictEqual( 'barExtension' );
	} );

	it( 'overriding namespace and mode preferences', () => {
		const extCodeMirrorConfig = {
			defaultPreferences: { lineNumbering: ENABLED, autocomplete: [ 0 /* NS_MAIN */ ] },
			primaryPreferences: { lineNumbering: true, autocomplete: true },
			preferenceModeIds
		};
		mockUserPreferences( {} );

		// We're editing a Template where autocomplete is disabled.
		mockMwConfigGet( {
			wgNamespaceNumber: 10,
			extCodeMirrorConfig
		} );

		// Some preliminary assertions.
		let preferences = getCodeMirrorPreferences( {
			lineNumbering: EditorView.theme(),
			autocomplete: EditorView.theme()
		} );
		expect( preferences.fetchPreferences() ).toStrictEqual( {
			lineNumbering: true,
			autocomplete: false
		} );
		expect( preferences.getDefaultPreferences() ).toStrictEqual( {
			lineNumbering: true,
			autocomplete: false
		} );

		// Enable autocomplete.
		preferences.setPreference( 'autocomplete', true );
		// Assert storage.
		expect( mw.user.options.set )
			.toHaveBeenCalledWith( 'codemirror-preferences', '{"autocomplete":2}' );

		// Now simulate editing an article.
		mockMwConfigGet( {
			wgNamespaceNumber: 0,
			extCodeMirrorConfig
		} );
		// We need to re-mock mw.user.options.get to return the updated preferences.
		mockUserPreferences( { autocomplete: ENABLED } );
		preferences = getCodeMirrorPreferences( {
			lineNumbering: EditorView.theme(),
			autocomplete: EditorView.theme()
		} );

		// More sanity checks.
		expect( preferences.fetchPreferences() ).toStrictEqual( {
			lineNumbering: true,
			autocomplete: true
		} );
		expect( preferences.getDefaultPreferences() ).toStrictEqual( {
			lineNumbering: true,
			// Autocomplete is on by default in NS_MAIN.
			autocomplete: true
		} );

		// Disable lineNumbering.
		preferences.setPreference( 'lineNumbering', false );
		// Assert storage, and that lineNumbering is still enabled, but now only for MEDIAWIKI_ONLY.
		expect( mw.user.options.set ).toHaveBeenCalledWith(
			'codemirror-preferences',
			'{"autocomplete":1,"lineNumbering":3}'
		);
		// Mock user preferences to return the updated preferences.
		mockUserPreferences( { lineNumbering: DISABLED, autocomplete: ENABLED } );
		// Autocomplete should still be enabled.
		expect( preferences.fetchPreferences() ).toStrictEqual( {
			lineNumbering: false,
			autocomplete: true
		} );
	} );

	it( 'logged out preferences', () => {
		mw.user.isNamed = jest.fn().mockReturnValue( false );
		let mockStorage = {
			// Opposite of the values set in beforeEach
			fooExtension: ENABLED,
			barExtension: DISABLED
		};
		mw.storage = {
			getObject: jest.fn( () => mockStorage ),
			setObject: jest.fn( ( key, value ) => {
				mockStorage = value;
			} )
		};

		mockDefaultPreferences();
		const preferences = getCodeMirrorPreferences();
		expect( preferences.fetchPreferences() ).toStrictEqual( {
			fooExtension: true,
			barExtension: false
		} );
		preferences.setPreference( 'barExtension', true );
		expect( preferences.fetchPreferences() ).toStrictEqual( {
			fooExtension: true,
			barExtension: true
		} );
	} );

	it( 'should delete a user option if it matches the defaults', () => {
		mockDefaultPreferences( { fooExtension: DISABLED, barExtension: ENABLED } );
		mockUserPreferences( { fooExtension: ENABLED, barExtension: ENABLED } );
		const preferences = getCodeMirrorPreferences();
		preferences.setPreference( 'fooExtension', false );
		expect( mw.user.options.set ).toHaveBeenCalledWith( 'codemirror-preferences', '{"fooExtension":3}' );
		// Simulate disabling fooExtension in non-wikitext.
		mockUserPreferences( { fooExtension: NON_MEDIAWIKI_ONLY, barExtension: ENABLED } );
		const preferences2 = getCodeMirrorPreferences( {
			fooExtension: EditorView.theme(),
			barExtension: EditorView.theme()
		}, 'css' );
		preferences2.setPreference( 'fooExtension', false );
		expect( mw.user.options.set ).toHaveBeenCalledWith( 'codemirror-preferences', null );
	} );

	it( 'should toggle the preference checkbox when the preferences panel is open', () => {
		mockDefaultPreferences( { fooExtension: DISABLED, barExtension: DISABLED } );
		mockUserPreferences( { fooExtension: DISABLED, barExtension: ENABLED } );
		const preferences = getCodeMirrorPreferences();
		const view = new EditorView();
		preferences.toggle( view );
		expect(
			preferences.panel.dom.querySelector( 'input[name="fooExtension"]' ).checked
		).toBe( false );
		preferences.registerExtension( 'fooExtension', EditorView.theme(), view );
		preferences.setPreference( 'fooExtension', true );
		expect(
			preferences.panel.dom.querySelector( 'input[name="fooExtension"]' ).checked
		).toBe( true );
	} );

	describe( 'default preferences', () => {
		const defPrefsTestCases = [
			{
				title: 'no user prefs',
				defaultPreferences: { lineNumbering: DISABLED, bracketMatching: ENABLED },
				nsId: 0,
				expected: { lineNumbering: false, bracketMatching: true }
			}, {
				title: 'lineNumbering only for Templates, editing mainspace',
				defaultPreferences: { lineNumbering: [ 10 ], bracketMatching: ENABLED },
				nsId: 0,
				expected: { lineNumbering: false, bracketMatching: true }
			}, {
				title: 'lineNumbering only for Templates, editing Template',
				defaultPreferences: { lineNumbering: [ 10 ], bracketMatching: ENABLED },
				nsId: 10,
				expected: { lineNumbering: true, bracketMatching: true }
			}, {
				title: 'bracketMatching only for CSS, editing wikitext',
				defaultPreferences: { lineNumbering: ENABLED, bracketMatching: [ 'css' ] },
				nsId: 10,
				expected: { lineNumbering: true, bracketMatching: false }
			}, {
				title: 'bracketMatching only for CSS, editing css',
				defaultPreferences: { lineNumbering: ENABLED, bracketMatching: [ 'css' ] },
				nsId: 10,
				mode: 'css',
				expected: { lineNumbering: true, bracketMatching: true }
			}, {
				title: 'lineNumbering for Templates or CSS, editing main/wikitext',
				defaultPreferences: { lineNumbering: [ 10, 'css' ], bracketMatching: ENABLED },
				nsId: 0,
				expected: { lineNumbering: false, bracketMatching: true }
			}, {
				title: 'lineNumbering for Templates or CSS, editing Template/wikitext',
				defaultPreferences: { lineNumbering: [ 10, 'css' ], bracketMatching: ENABLED },
				nsId: 10,
				expected: { lineNumbering: true, bracketMatching: true }
			}, {
				title: 'lineNumbering for Templates or CSS, editing Template/css',
				defaultPreferences: { lineNumbering: [ 10, 'css' ], bracketMatching: ENABLED },
				nsId: 10,
				mode: 'css',
				expected: { lineNumbering: true, bracketMatching: true }
			}
		];
		it.each( defPrefsTestCases )(
			'default preferences ($title)',
			( { defaultPreferences, nsId, mode, expected } ) => {
				mockMwConfigGet( {
					extCodeMirrorConfig: {
						defaultPreferences,
						primaryPreferences: defaultPreferences,
						preferenceModeIds
					},
					wgNamespaceNumber: nsId
				} );
				mockUserPreferences( {} );
				const preferences = getCodeMirrorPreferences(
					{
						lineNumbering: EditorView.theme(),
						bracketMatching: EditorView.theme()
					},
					mode
				);
				expect( preferences.getDefaultPreferences() ).toStrictEqual( expected );
			}
		);
	} );

	it( 'getCheckboxesFieldset', () => {
		mockDefaultPreferences();
		mockUserPreferences( { fooExtension: ENABLED, barExtension: ENABLED } );
		const preferences = getCodeMirrorPreferences();
		const fieldset = preferences.getCheckboxesFieldset(
			[ 'fooExtension', 'barExtension', 'doesNotExistExtension' ]
		);
		const checkboxes = fieldset.querySelectorAll( '.cdx-checkbox__label' );
		expect( checkboxes.length ).toBe( 2 );
		expect( checkboxes[ 0 ].textContent ).toBe( 'codemirror-prefs-fooextension' );
		expect( checkboxes[ 1 ].textContent ).toBe( 'codemirror-prefs-barextension' );
	} );

	it( 'primary preferences - panel / showPreferencesDialog', () => {
		const realPreferences = {
			lineNumbering: ENABLED,
			bracketMatching: ENABLED,
			autocomplete: ENABLED,
			openLinks: ENABLED
		};
		mockDefaultPreferences(
			realPreferences,
			{ lineNumbering: ENABLED, bracketMatching: ENABLED }
		);
		mockUserPreferences( {
			lineNumbering: ENABLED,
			bracketMatching: ENABLED,
			autocomplete: ENABLED,
			openLinks: ENABLED
		} );
		const view = new EditorView();
		const openLinks = EditorView.theme();
		const preferences = getCodeMirrorPreferences( {
			lineNumbering: EditorView.theme(),
			bracketMatching: EditorView.theme(),
			autocomplete: EditorView.theme(),
			openLinks
		} );
		// openLinks is MW-specific, so we'll need to register it separately here in the test.
		preferences.registerExtension( 'openLinks', openLinks, view );
		// Panel should only show lineNumbering and bracketMatching.
		const panelCheckboxes = preferences.panel.dom.querySelectorAll( '.cdx-checkbox__label' );
		expect( panelCheckboxes.length ).toBe( 2 );
		expect( panelCheckboxes[ 0 ].textContent ).toBe( 'codemirror-prefs-linenumbering' );
		expect( panelCheckboxes[ 1 ].textContent ).toBe( 'codemirror-prefs-bracketmatching' );
		// Show the full dialog.
		preferences.showPreferencesDialog( view );
		const dialog = preferences.dialog.querySelector( '.cm-mw-preferences-dialog' );
		const fieldsets = dialog.querySelectorAll( '.cm-mw-panel--fieldset' );
		expect( fieldsets.length ).toBe( 3 );
		expect( fieldsets[ 0 ].querySelector( 'legend' ).textContent )
			.toBe( 'codemirror-prefs-section-lines' );
		expect( fieldsets[ 0 ].querySelector( '.cdx-checkbox__label' ).textContent )
			.toBe( 'codemirror-prefs-linenumbering' );
		expect( fieldsets[ 1 ].querySelector( 'legend' ).textContent )
			.toBe( 'codemirror-prefs-section-code-assistance' );
		expect( fieldsets[ 1 ].querySelectorAll( '.cdx-checkbox__label' )[ 0 ].textContent )
			.toBe( 'codemirror-prefs-autocomplete' );
		expect( fieldsets[ 1 ].querySelectorAll( '.cdx-checkbox__label' )[ 1 ].textContent )
			.toBe( 'codemirror-prefs-bracketmatching' );
		expect( fieldsets[ 2 ].querySelector( 'legend' ).textContent )
			.toBe( 'codemirror-prefs-section-other' );
		expect( fieldsets[ 2 ].querySelector( '.cdx-checkbox__label' ).textContent )
			.toBe( 'codemirror-prefs-openlinks' );
	} );

	it( 'lockPreference', () => {
		mockDefaultPreferences();
		mockUserPreferences( { fooExtension: ENABLED } );
		const view = new EditorView();
		const preferences = getCodeMirrorPreferences();
		preferences.registerExtension( 'fooExtension', EditorView.theme(), view );
		expect( preferences.getPreference( 'fooExtension' ) ).toBe( true );
		const hookSpy = jest.spyOn( preferences, 'firePreferencesApplyHook' );
		preferences.lockPreference( 'fooExtension', view, false );
		expect( preferences.getPreference( 'fooExtension' ) ).toBe( false );
		const panel = preferences.panel;
		expect( panel.dom.querySelector( 'input[name="fooExtension"]' ).disabled ).toBe( true );
		expect( panel.dom.querySelector( 'input[name="fooExtension"]' ).checked ).toBe( false );
		expect( hookSpy ).toHaveBeenCalledWith( 'fooExtension', false );
	} );

	it( 'registerCallback', () => {
		mockDefaultPreferences( { foobar: ENABLED } );
		mockUserPreferences();
		const callback = jest.fn();
		const preferences = getCodeMirrorPreferences();
		const view = new EditorView();
		preferences.registerCallback( 'foobar', callback, view );
		expect( callback ).toHaveBeenCalledWith( true );
		expect( preferences.extensionRegistry.extensions.foobar ).toBeDefined();
		preferences.setPreference( 'foobar', false );
		expect( callback ).toHaveBeenCalledWith( false );
	} );

	it( 'slow preferences', () => {
		mockDefaultPreferences( { slowExtension: DISABLED, slowCallback: DISABLED } );
		const preferences = getCodeMirrorPreferences();
		const view = new EditorView();
		preferences.registerExtension( 'slowExtension', EditorView.theme(), view, { slow: true } );
		expect( preferences.slowPreferences.has( 'slowExtension' ) ).toBe( true );
		preferences.registerCallback( 'slowCallback', jest.fn(), view, { slow: true } );
		expect( preferences.slowPreferences.has( 'slowCallback' ) ).toBe( true );
		preferences.showPreferencesDialog( view );
		expect( preferences.dialog.querySelectorAll( '.cm-mw-slow-feature' ).length ).toBe( 2 );
	} );
} );
