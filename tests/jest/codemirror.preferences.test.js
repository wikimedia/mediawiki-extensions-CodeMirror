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
		/* eslint-disable-next-line arrow-body-style */
		getCodeMirrorPreferences = () => {
			return new CodeMirrorPreferences( {
				fooExtension: EditorView.theme(),
				barExtension: EditorView.theme()
			} );
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
		const fooExtension = EditorView.theme();
		const barExtension = EditorView.theme();
		const preferences = getCodeMirrorPreferences( { fooExtension, barExtension } );
		const view = new EditorView();
		preferences.registerExtension( 'barExtension', barExtension, view );
		expect( preferences.extensionRegistry.barExtension ).toStrictEqual( barExtension );
		expect( preferences.compartmentRegistry.barExtension ).toBeInstanceOf( Compartment );
		expect( preferences.compartmentRegistry.barExtension.get( view.state ).length )
			.toStrictEqual( 2 );
	} );
} );
