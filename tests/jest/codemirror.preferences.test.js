/* eslint-disable-next-line n/no-missing-require */
const { EditorView } = require( 'ext.CodeMirror.v6.lib' );
const CodeMirrorPreferences = require( '../../resources/codemirror.preferences.js' );
const CodeMirrorExtensionRegistry = require( '../../resources/codemirror.extensionRegistry.js' );

describe( 'CodeMirrorPreferences', () => {
	let mockDefaultPreferences, mockUserPreferences, getCodeMirrorPreferences;

	beforeEach( () => {
		mockDefaultPreferences = ( config = { fooExtension: false, barExtension: true } ) => {
			mw.config.get = jest.fn().mockReturnValue( {
				defaultPreferences: config
			} );
		};
		mockUserPreferences = ( preferences = {} ) => {
			mw.user.options.get = jest.fn().mockReturnValue( JSON.stringify( preferences ) );
		};
		getCodeMirrorPreferences = ( extConfig = {
			fooExtension: EditorView.theme(),
			barExtension: EditorView.theme()
		/* eslint-disable-next-line arrow-body-style */
		}, isVisualEditor = false ) => {
			return new CodeMirrorPreferences(
				new CodeMirrorExtensionRegistry( extConfig, isVisualEditor ),
				isVisualEditor
			);
		};
	} );

	it( 'defaultPreferences', () => {
		mockDefaultPreferences();
		const preferences = getCodeMirrorPreferences();
		expect( preferences.defaultPreferences ).toStrictEqual( {
			fooExtension: false,
			barExtension: true
		} );
	} );

	it( 'fetchPreferences', () => {
		mockDefaultPreferences();
		mockUserPreferences( { fooExtension: 1 } );
		mw.user.isNamed = jest.fn().mockReturnValue( true );
		const preferences = getCodeMirrorPreferences();
		expect( preferences.fetchPreferences() ).toStrictEqual( {
			fooExtension: true,
			barExtension: true
		} );
	} );

	it( 'setPreference', () => {
		mockDefaultPreferences();
		mw.user.isNamed = jest.fn().mockReturnValue( true );
		const preferences = getCodeMirrorPreferences();
		preferences.setPreference( 'fooExtension', true );
		expect( preferences.preferences.fooExtension ).toStrictEqual( true );
		expect( mw.user.options.set ).toHaveBeenCalledWith( 'codemirror-preferences', '{"fooExtension":1}' );
		expect( mw.Api.prototype.saveOption ).toHaveBeenCalledWith( 'codemirror-preferences', '{"fooExtension":1}' );
	} );

	it( 'getPreference', () => {
		mockDefaultPreferences();
		mockUserPreferences( { barExtension: 0 } );
		const preferences = getCodeMirrorPreferences();
		expect( preferences.getPreference( 'fooExtension' ) ).toStrictEqual( false );
		expect( preferences.getPreference( 'barExtension' ) ).toStrictEqual( false );
	} );

	it( 'getPreference (VisualEditor)', () => {
		mockDefaultPreferences( { fooExtension: true, bracketMatching: false } );
		mockUserPreferences( { bracketMatching: 1 } );
		const preferences = getCodeMirrorPreferences( {
			fooExtension: EditorView.theme(),
			bracketMatching: EditorView.theme()
		}, true );
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
		mockUserPreferences( { bazExtension: 1 } );
		const bazExtension = EditorView.theme();
		const preferences = getCodeMirrorPreferences();
		const view = new EditorView();
		preferences.registerExtension( 'bazExtension', bazExtension, view );
		// HACK: Tests against CompartmentInstance `#inner` property to get the Extension instance.
		expect( preferences.extensionRegistry.get( 'bazExtension' ).inner ).toBe( bazExtension );
		expect( preferences.extensionRegistry.isEnabled( 'bazExtension', view ) ).toBeTruthy();
	} );

	it( 'extension', () => {
		mockUserPreferences( { fooExtension: 1, barExtension: 1 } );
		const preferences = getCodeMirrorPreferences( { fooExtension: true, barExtension: true } );
		const hookSpy = jest.spyOn( preferences, 'firePreferencesApplyHook' );
		const ext = preferences.extension;
		expect( ext[ 0 ].constructor.name ).toStrictEqual( 'FacetProvider' );
		// fooExtension and barExtension
		expect( ext[ 1 ].length ).toStrictEqual( 2 );
		expect( hookSpy ).toHaveBeenCalledTimes( 2 );
	} );

	it( 'panel', () => {
		mockDefaultPreferences();
		mockUserPreferences( { fooExtension: 1, barExtension: 0, inapplicableExtension: 1 } );
		const preferences = getCodeMirrorPreferences();
		const panel = preferences.panel;
		expect( panel.dom.className ).toStrictEqual( 'cm-mw-preferences-panel cm-mw-panel' );
		const checkboxes = panel.dom.querySelectorAll( '.cdx-checkbox__input' );
		expect( checkboxes.length ).toStrictEqual( 2 );
		expect( checkboxes[ 0 ].name ).toStrictEqual( 'fooExtension' );
		expect( checkboxes[ 1 ].name ).toStrictEqual( 'barExtension' );
	} );

	it( 'overriding namespace and content model preferences', () => {
		const extCodeMirrorConfig = {
			defaultPreferences: { lineNumbering: true, autocomplete: [ 0 ] }
		};
		mockUserPreferences( {} );

		// We're editing a Template where autocomplete is disabled.
		mockMwConfigGet( {
			wgNamespaceNumber: 10,
			wgPageContentModel: 'wikitext',
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
			.toHaveBeenCalledWith( 'codemirror-preferences', '{"autocomplete":1}' );

		// Now simulate editing an article.
		mockMwConfigGet( {
			wgNamespaceNumber: 0,
			wgPageContentModel: 'wikitext',
			extCodeMirrorConfig
		} );
		// We need to re-mock mw.user.options.get to return the updated preferences.
		mockUserPreferences( { autocomplete: 1 } );
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
		// Assert storage, and that autocomplete is still enabled.
		expect( mw.user.options.set ).toHaveBeenCalledWith(
			'codemirror-preferences',
			'{"lineNumbering":0,"autocomplete":1}'
		);
		// Mock user preferences to return the updated preferences.
		mockUserPreferences( { lineNumbering: 0, autocomplete: 1 } );
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
			fooExtension: 1,
			barExtension: 0
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
		mockDefaultPreferences( { fooExtension: false, barExtension: true } );
		mockUserPreferences( { fooExtension: 1, barExtension: 1 } );
		const preferences = getCodeMirrorPreferences();
		preferences.setPreference( 'fooExtension', false );
		expect( mw.user.options.set ).toHaveBeenCalledWith( 'codemirror-preferences', null );
	} );

	it( 'should toggle the preference checkbox when the preferences panel is open', () => {
		mockDefaultPreferences( { fooExtension: false, barExtension: false } );
		mockUserPreferences( { fooExtension: 0, barExtension: 1 } );
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

	const defPrefsTestCases = [
		{
			title: 'no user prefs',
			defaultPreferences: { lineNumbering: false, bracketMatching: true },
			nsId: 0,
			contentModel: 'wikitext',
			expected: { lineNumbering: false, bracketMatching: true }
		}, {
			title: 'lineNumbering only for Templates, editing mainspace',
			defaultPreferences: { lineNumbering: [ 10 ], bracketMatching: true },
			nsId: 0,
			contentModel: 'wikitext',
			expected: { lineNumbering: false, bracketMatching: true }
		}, {
			title: 'lineNumbering only for Templates, editing Template',
			defaultPreferences: { lineNumbering: [ 10 ], bracketMatching: true },
			nsId: 10,
			contentModel: 'wikitext',
			expected: { lineNumbering: true, bracketMatching: true }
		}, {
			title: 'bracketMatching only for CSS, editing wikitext',
			defaultPreferences: { lineNumbering: true, bracketMatching: [ 'css' ] },
			nsId: 10,
			contentModel: 'wikitext',
			expected: { lineNumbering: true, bracketMatching: false }
		}, {
			title: 'bracketMatching only for CSS, editing css',
			defaultPreferences: { lineNumbering: true, bracketMatching: [ 'css' ] },
			nsId: 10,
			contentModel: 'css',
			expected: { lineNumbering: true, bracketMatching: true }
		}, {
			title: 'lineNumbering for Templates or CSS, editing main/wikitext',
			defaultPreferences: { lineNumbering: [ 10, 'css' ], bracketMatching: true },
			nsId: 0,
			contentModel: 'wikitext',
			expected: { lineNumbering: false, bracketMatching: true }
		}, {
			title: 'lineNumbering for Templates or CSS, editing Template/wikitext',
			defaultPreferences: { lineNumbering: [ 10, 'css' ], bracketMatching: true },
			nsId: 10,
			contentModel: 'wikitext',
			expected: { lineNumbering: true, bracketMatching: true }
		}, {
			title: 'lineNumbering for Templates or CSS, editing Template/css',
			defaultPreferences: { lineNumbering: [ 10, 'css' ], bracketMatching: true },
			nsId: 10,
			contentModel: 'css',
			expected: { lineNumbering: true, bracketMatching: true }
		}
	];
	it.each( defPrefsTestCases )(
		'default preferences ($title)',
		( { defaultPreferences, nsId, contentModel, expected } ) => {
			mockMwConfigGet( {
				extCodeMirrorConfig: { defaultPreferences },
				wgNamespaceNumber: nsId,
				wgPageContentModel: contentModel
			} );
			mockUserPreferences( {} );
			const preferences = getCodeMirrorPreferences();
			expect( preferences.getDefaultPreferences() ).toStrictEqual( expected );
		}
	);
} );
