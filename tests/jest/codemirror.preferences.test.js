/* eslint-disable-next-line n/no-missing-require */
const { Compartment, EditorView } = require( 'ext.CodeMirror.v6.lib' );
const CodeMirrorPreferences = require( '../../resources/codemirror.preferences.js' );

describe( 'CodeMirrorPreferences', () => {
	let mockDefaultPreferences, mockUserPreferences, getCodeMirrorPreferences;

	beforeEach( () => {
		mockDefaultPreferences = ( config = { fooExtension: false, barExtension: true } ) => {
			mw.config.get = jest.fn().mockReturnValue( {
				defaultPreferences: config
			} );
		};
		mockUserPreferences = ( preferences = {} ) => {
			mw.user.options.get = jest.fn().mockReturnValue( preferences );
		};
		getCodeMirrorPreferences = ( extensionRegistry = {
			fooExtension: EditorView.theme(),
			barExtension: EditorView.theme()
		/* eslint-disable-next-line arrow-body-style */
		}, isVisualEditor = false ) => {
			return new CodeMirrorPreferences( extensionRegistry, isVisualEditor );
		};
	} );

	it( 'VisualEditor shouldn\'t use unsupported extensions', () => {
		mockDefaultPreferences( {
			fooExtension: true,
			barExtension: true,
			bracketMatching: true
		} );
		const preferences = getCodeMirrorPreferences( {
			fooExtension: EditorView.theme(),
			barExtension: EditorView.theme(),
			bracketMatching: EditorView.theme()
		}, true );
		expect( Object.keys( preferences.extensionRegistry ) )
			.toStrictEqual( [ 'bracketMatching' ] );
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
		mockUserPreferences( '{"fooExtension":1}' );
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
		mockUserPreferences( '{"barExtension":0}' );
		const preferences = getCodeMirrorPreferences();
		expect( preferences.getPreference( 'fooExtension' ) ).toStrictEqual( false );
		expect( preferences.getPreference( 'barExtension' ) ).toStrictEqual( false );
	} );

	it( 'registerExtension', () => {
		mockDefaultPreferences( { fooExtension: false, barExtension: false } );
		mockUserPreferences( '{"fooExtension":0,"barExtension":1}' );
		const barExtension = EditorView.theme();
		const preferences = getCodeMirrorPreferences();
		const view = new EditorView();
		preferences.registerExtension( 'barExtension', barExtension, view );
		expect( preferences.extensionRegistry.barExtension ).toStrictEqual( barExtension );
		expect( preferences.compartmentRegistry.barExtension ).toBeInstanceOf( Compartment );
		expect( preferences.compartmentRegistry.barExtension.get( view.state ).length )
			.toStrictEqual( 2 );
	} );

	it( 'extension', () => {
		const preferences = getCodeMirrorPreferences();
		const ext = preferences.extension;
		expect( ext[ 0 ].constructor.name ).toStrictEqual( 'FacetProvider' );
	} );

	it( 'panel', () => {
		const preferences = getCodeMirrorPreferences();
		const panel = preferences.panel;
		expect( panel.dom.className ).toStrictEqual( 'cm-mw-preferences-panel cm-mw-panel' );
		const checkboxes = panel.dom.querySelectorAll( '.cdx-checkbox__input' );
		expect( checkboxes.length ).toStrictEqual( 2 );
		expect( checkboxes[ 0 ].name ).toStrictEqual( 'fooExtension' );
		expect( checkboxes[ 1 ].name ).toStrictEqual( 'barExtension' );
	} );

	it( 'logged out preferences', () => {
		mw.user.isNamed = jest.fn().mockReturnValue( false );
		let mockStorage = {
			// Opposite of the values set in beforeEach
			fooExtension: true,
			barExtension: false
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
} );
