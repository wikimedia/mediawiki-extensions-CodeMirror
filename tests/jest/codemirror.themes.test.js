/* eslint-disable-next-line n/no-missing-require */
const { EditorView } = require( 'ext.CodeMirror.lib' );
const CodeMirrorExtensionRegistry = require( '../../resources/codemirror.extensionRegistry.js' );
const CodeMirrorKeymap = require( '../../resources/codemirror.keymap.js' );
const CodeMirrorPreferences = require( '../../resources/codemirror.preferences.js' );
const CodeMirrorThemes = require( '../../resources/themes/codemirror.themes.js' );

let preferences, themes, view;

describe( 'CodeMirrorThemes', () => {
	beforeEach( () => {
		preferences = new CodeMirrorPreferences(
			new CodeMirrorExtensionRegistry( {} ),
			'javascript',
			new CodeMirrorKeymap()
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
		// Restore the default config, which a test may have replaced outright.
		mockMwConfigGet();
	} );

	it( 'addFormSpec', () => {
		expect( preferences.formSpecification.get( 'theme' ).options )
			.toStrictEqual( new Map( themes.getOptions() ) );
	} );

	it( 'falls back to the default theme when the mode has no such theme', () => {
		// A wiki can set any theme as the default, but wikitext offers only a few.
		mockMwConfigGet( {
			extCodeMirrorConfig: { defaultPreferences: { theme: 'github' } }
		} );
		const mwPreferences = new CodeMirrorPreferences(
			new CodeMirrorExtensionRegistry( {} ),
			'mediawiki',
			new CodeMirrorKeymap()
		);
		const mwThemes = new CodeMirrorThemes( mwPreferences );
		expect( mwPreferences.getPreference( 'theme' ) ).toBe( 'github' );
		expect( mwThemes.themes.has( 'github-light' ) ).toBe( false );
		expect( mwThemes.getThemeName() ).toBe( 'default' );
		document.documentElement.classList.add( 'skin-theme-clientpref-day' );
		mwThemes.registerFromValueMap( view );
		expect( mwThemes.extensionRegistry.get( 'theme' ).compartment.get( view.state )[ 0 ] )
			.toStrictEqual( mwThemes.themes.get( 'default-light' ) );
		expect( view.state.facet( mwThemes.themeFacet ) ).toBe( 'default' );
	} );

	it( 'addDarkModeMutationObserver', async () => {
		document.documentElement.classList.add( 'skin-theme-clientpref-os' );
		const matchMedia = window.matchMedia;
		window.matchMedia = jest.fn().mockImplementation( ( query ) => ( {
			'(prefers-color-scheme: dark)': { matches: true, addEventListener: jest.fn() },
			print: matchMedia( 'print' )
			// Defer any other query, so that adding one elsewhere cannot break this mock.
		}[ query ] || matchMedia( query ) ) );
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
		expect( themes.preferences.getPreference( 'theme' ) ).toBe( 'default' );
		// The styles, plus the facet naming the applied theme.
		expect( themes.extensionRegistry.get( 'theme' ).compartment.get( view.state )[ 0 ] )
			.toStrictEqual( themes.themes.get( 'default-light' ) );
		expect( view.state.facet( themes.themeFacet ) ).toBe( 'default' );
		expect( view.editorAttrs.class.includes( 'cm-mw-theme-default' ) ).toBeTruthy();
		// Change to GitHub theme.
		preferences.showPreferencesDialog( view );
		const select = document.querySelector( '.cm-mw-panel__select--theme select' );
		select.value = 'github';
		select.dispatchEvent( new Event( 'change' ) );
		expect( themes.preferences.getPreference( 'theme' ) ).toBe( 'github' );
		expect( themes.extensionRegistry.get( 'theme' ).compartment.get( view.state )[ 0 ] )
			.toStrictEqual( themes.themes.get( 'github-light' ) );
		expect( view.state.facet( themes.themeFacet ) ).toBe( 'github' );
		expect( view.editorAttrs.class.includes( 'cm-mw-theme-default' ) ).toBeFalsy();
		expect( view.editorAttrs.class.includes( 'cm-mw-theme-github' ) ).toBeTruthy();
		// Now switch to dark mode.
		document.documentElement.classList.remove( 'skin-theme-clientpref-day' );
		document.documentElement.classList.add( 'skin-theme-clientpref-night' );
		await new Promise( process.nextTick );
		expect( themes.extensionRegistry.get( 'theme' ).compartment.get( view.state )[ 0 ] )
			.toStrictEqual( themes.themes.get( 'github-dark' ) );
		expect( view.state.facet( themes.themeFacet ) ).toBe( 'github' );
		expect( view.editorAttrs.class.includes( 'cm-mw-theme-github' ) ).toBeTruthy();
	} );
} );
