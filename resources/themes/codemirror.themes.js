const { EditorView, Extension, oneDark } = require( 'ext.CodeMirror.lib' );
const basicLight = require( './codemirror.theme.basic-light.js' );
const basicDark = require( './codemirror.theme.basic-dark.js' );
const githubLight = require( './codemirror.theme.github-light.js' );
const githubDark = require( './codemirror.theme.github-dark.js' );
const gruvboxLight = require( './codemirror.theme.gruvbox-light.js' );
const gruvboxDark = require( './codemirror.theme.gruvbox-dark.js' );
const highContrastLight = require( './codemirror.theme.high-contrast-light.js' );
const highContrastDark = require( './codemirror.theme.high-contrast-dark.js' );
const materialLight = require( './codemirror.theme.material-light.js' );
const materialDark = require( './codemirror.theme.material-dark.js' );
const solarizedLight = require( './codemirror.theme.solarized-light.js' );
const solarizedDark = require( './codemirror.theme.solarized-dark.js' );
const tokyoNightDay = require( './codemirror.theme.tokyo-night-day.js' );
const tokyoNightStorm = require( './codemirror.theme.tokyo-night-storm.js' );
const vsCodeLight = require( './codemirror.theme.vscode-light.js' );
const vsCodeDark = require( './codemirror.theme.vscode-dark.js' );

/**
 * This class houses all logic involving
 * {@link https://codemirror.net/examples/styling/#themes themes}.
 * It adds the available themes as a dropdown in the {@link CodeMirrorPreferences preferences}
 * form and registers them in the {@link CodeMirrorExtensionRegistry extension registry}.
 *
 * Themes are forked from
 * {@link https://github.com/fsegurai/codemirror-themes @fsegurai/codemirror-theme-bundle} (MIT).
 *
 * The constructor is internal. The class can be accessed via {@link CodeMirror#themes}.
 */
class CodeMirrorThemes {

	/**
	 * @param {CodeMirrorPreferences} preferences
	 * @internal
	 * @hideconstructor
	 */
	constructor( preferences ) {
		/** @type {CodeMirrorPreferences} */
		this.preferences = preferences;
		/** @type {CodeMirrorExtensionRegistry} */
		this.extensionRegistry = preferences.extensionRegistry;
		/** @type {EditorView} */
		this.view = null;

		/**
		 * The <html> element, which is used to determine whether the skin is in dark mode.
		 *
		 * @type {HTMLElement}
		 */
		this.docElement = document.documentElement;
		/**
		 * A MediaQueryList that matches if the user has set their
		 * OS-level color scheme preference to dark.
		 *
		 * @type {MediaQueryList}
		 */
		this.matchMediaQuery = window.matchMedia( '(prefers-color-scheme: dark)' );

		// Initialization
		this.addFormSpec();
		this.setLightOrDarkMode();
		this.addDarkModeMutationObserver();
	}

	/**
	 * Whether the skin is in dark mode.
	 *
	 * @type {boolean}
	 */
	get isDark() {
		return this.docElement.classList.contains( 'skin-theme-clientpref-night' ) || (
			this.docElement.classList.contains( 'skin-theme-clientpref-os' ) &&
			this.matchMediaQuery.matches
		);
	}

	/**
	 * The user's preferred theme, as stored in the preferences.
	 *
	 * @type {PrefValue}
	 */
	get preferredTheme() {
		return this.preferences.getPreference( 'theme' );
	}

	/**
	 * Mapping of available themes and their Extensions.
	 *
	 * @type {Map<string, Extension>}
	 * @internal
	 */
	get themes() {
		if ( this.cachedThemes ) {
			return this.cachedThemes;
		}

		let entries;

		// For now, the MW mode only allows for default, colorblind, and no highlighting.
		if ( this.preferences.mode === 'mediawiki' ) {
			const colorblindTheme = EditorView.contentAttributes.of( {
				class: 'cm-mw-colorblind-colors'
			} );
			// Light and dark modes are controlled by CSS, so the definitions are identical.
			entries = [
				[ 'default-light', [] ],
				[ 'default-dark', [] ],
				[ 'colorblind-light', colorblindTheme ],
				[ 'colorblind-dark', colorblindTheme ],
				[ 'no-highlight-light', [] ],
				[ 'no-highlight-dark', [] ]
			];
		} else {
			entries = [
				[ 'default-light', [] ],
				[ 'default-dark', oneDark ],
				[ 'basic-light', basicLight ],
				[ 'basic-dark', basicDark ],
				[ 'github-light', githubLight ],
				[ 'github-dark', githubDark ],
				[ 'gruvbox-light', gruvboxLight ],
				[ 'gruvbox-dark', gruvboxDark ],
				[ 'high-contrast-light', highContrastLight ],
				[ 'high-contrast-dark', highContrastDark ],
				[ 'material-light', materialLight ],
				[ 'material-dark', materialDark ],
				[ 'solarized-light', solarizedLight ],
				[ 'solarized-dark', solarizedDark ],
				[ 'tokyo-night-light', tokyoNightDay ],
				[ 'tokyo-night-dark', tokyoNightStorm ],
				[ 'vscode-light', vsCodeLight ],
				[ 'vscode-dark', vsCodeDark ]
			];
		}

		// Loop through and add an editor attributes class for theme,
		// so we can target specific themes in CSS.
		entries = entries.map(
			( [ name, extension ] ) => [ name, [
				extension,
				EditorView.editorAttributes.of( {
					class: `cm-mw-theme-${ name.replace( /-(light|dark)$/, '' ) }`
				} )
			] ]
		);

		this.cachedThemes = new Map( entries );
		return this.cachedThemes;
	}

	/**
	 * Add a <select> form field to CodeMirrorPreferences.
	 * We add a single entry for each theme, removing any -light or -dark suffix,
	 * and allow the skin to dictate which is used with respect to dark mode.
	 *
	 * @private
	 */
	addFormSpec() {
		this.preferences.formSpecification.set( 'theme', {
			type: 'select',
			label: 'codemirror-prefs-theme',
			options: new Map( this.getOptions() ),
			default: this.preferredTheme
		} );
	}

	/**
	 * Use a MutationObserver to watch for CSS class changes to the <html> element,
	 * and update the editor theme to the light/dark variant accordingly.
	 *
	 * @private
	 */
	addDarkModeMutationObserver() {
		const observer = new MutationObserver( ( mutations ) => {
			for ( const mutation of mutations ) {
				if ( mutation.type === 'attributes' && mutation.attributeName === 'class' ) {
					this.setLightOrDarkMode();
				}
			}
		} );
		observer.observe( this.docElement, {
			attributes: true,
			childList: false,
			subtree: false
		} );
		this.matchMediaQuery.addEventListener( 'change', () => this.setLightOrDarkMode() );
	}

	/**
	 * Update the theme's reconfiguration values in the extension registry
	 * and reconfigure the extension to use the new preferred value.
	 *
	 * @private
	 */
	setLightOrDarkMode() {
		this.extensionRegistry.reconfigValueMap.set( 'theme', new Map(
			this.getOptions().map( ( [ , name ] ) => [
				name,
				this.themes.get( `${ name }-${ this.isDark ? 'dark' : 'light' }` )
			] )
		) );
		if ( this.view ) {
			// Reconfigure the currently enabled theme with the new theme.
			this.extensionRegistry.reconfigureFromValueMap( 'theme', this.view, this.preferredTheme );
		}
	}

	/**
	 * Get the options for the theme selector dropdown.
	 *
	 * @return {Array}
	 * @private
	 */
	getOptions() {
		return Array.from( this.themes.keys() ).map( ( name ) => {
			name = name.replace( /-(light|dark)$/, '' );
			return [ `codemirror-theme-${ name }`, name ];
		} );
	}

	/**
	 * To be called during CodeMirror initialization, once the EditorView is available.
	 *
	 * @param {EditorView} view
	 * @internal
	 * @private
	 */
	registerFromValueMap( view ) {
		this.view = view;
		this.extensionRegistry.registerFromValueMap( 'theme', this.view, this.preferredTheme );
	}
}

module.exports = CodeMirrorThemes;
