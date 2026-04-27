/* eslint-disable-next-line n/no-missing-require */
const { EditorView } = require( 'ext.CodeMirror.lib' );
const CodeMirrorExtensionRegistry = require( '../../resources/codemirror.extensionRegistry.js' );
const CodeMirrorPreferences = require( '../../resources/codemirror.preferences.js' );
const CodeMirrorThemes = require( '../../resources/themes/codemirror.themes.js' );

let preferences, themes, view;

describe( 'CodeMirrorThemes', () => {
	beforeEach( () => {
		preferences = new CodeMirrorPreferences(
			new CodeMirrorExtensionRegistry( {} ),
			'javascript'
		);
		themes = new CodeMirrorThemes( preferences );
		view = new EditorView();
	} );

	afterEach( () => {
		document.body.innerHTML = '';
		document.documentElement.classList.remove(
			'skin-theme-clientpref-day', 'skin-theme-clientpref-night', 'skin-theme-clientpref-os'
		);
		jest.restoreAllMocks();
	} );

	it( 'addFormSpec', () => {
		expect( preferences.formSpecification.get( 'theme' ).options )
			.toStrictEqual( new Map( themes.getOptions() ) );
	} );

	it( 'addDarkModeMutationObserver', async () => {
		document.documentElement.classList.add( 'skin-theme-clientpref-os' );
		const matchMedia = window.matchMedia;
		window.matchMedia = jest.fn().mockImplementation( ( query ) => ( {
			'(prefers-color-scheme: dark)': { matches: true, addEventListener: jest.fn() },
			print: matchMedia( 'print' )
		}[ query ] ) );
		const themes2 = new CodeMirrorThemes( preferences );
		// Sanity check.
		expect( view.state.facet( EditorView.darkTheme ) ).toBeFalsy();
		themes2.registerFromValueMap( view );
		expect( view.state.facet( EditorView.darkTheme ) ).toBeTruthy();
		document.documentElement.classList.remove( 'skin-theme-clientpref-os' );
		document.documentElement.classList.add( 'skin-theme-clientpref-day' );
		await new Promise( process.nextTick );
		expect( view.state.facet( EditorView.darkTheme ) ).toBeFalsy();
	} );

	it( 'changing themes and toggling dark mode', async () => {
		// Should be default-light to start with.
		document.documentElement.classList.add( 'skin-theme-clientpref-day' );
		themes.registerFromValueMap( view );
		expect( themes.preferredTheme ).toBe( 'default' );
		expect( themes.preferences.getPreference( 'theme' ) ).toBe( 'default' );
		expect( themes.extensionRegistry.get( 'theme' ).compartment.get( view.state ) ).toStrictEqual(
			themes.themes.get( 'default-light' )
		);
		expect( view.editorAttrs.class.includes( 'cm-mw-theme-default' ) ).toBeTruthy();
		// Change to GitHub theme.
		preferences.showPreferencesDialog( view );
		const select = document.querySelector( '.cm-mw-panel__select--theme select' );
		select.value = 'github';
		select.dispatchEvent( new Event( 'change' ) );
		expect( themes.preferredTheme ).toBe( 'github' );
		expect( themes.extensionRegistry.get( 'theme' ).compartment.get( view.state ) ).toStrictEqual(
			themes.themes.get( 'github-light' )
		);
		expect( view.editorAttrs.class.includes( 'cm-mw-theme-default' ) ).toBeFalsy();
		expect( view.editorAttrs.class.includes( 'cm-mw-theme-github' ) ).toBeTruthy();
		// Now switch to dark mode.
		document.documentElement.classList.remove( 'skin-theme-clientpref-day' );
		document.documentElement.classList.add( 'skin-theme-clientpref-night' );
		await new Promise( process.nextTick );
		expect( themes.extensionRegistry.get( 'theme' ).compartment.get( view.state ) ).toStrictEqual(
			themes.themes.get( 'github-dark' )
		);
		expect( view.editorAttrs.class.includes( 'cm-mw-theme-github' ) ).toBeTruthy();
	} );
} );
