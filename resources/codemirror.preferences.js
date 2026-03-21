const {
	EditorView,
	Extension,
	StateEffect,
	StateEffectType,
	StateField,
	keymap,
	showPanel
} = require( 'ext.CodeMirror.v6.lib' );
const CodeMirrorPanel = require( './codemirror.panel.js' );
const CodeMirrorExtensionRegistry = require( './codemirror.extensionRegistry.js' );
require( './ext.CodeMirror.data.js' );

/**
 * CodeMirrorPreferences is a panel that allows users to configure CodeMirror preferences.
 * It is toggled by pressing `Ctrl`-`Shift`-`,` (or `Command`-`Shift`-`,` on macOS).
 * Only the commonly used "primary" preferences with a visual effect are shown in the panel,
 * in order to reduce in-editor clutter. A "More preferences" link is provided to open a dialog
 * with all available preferences. This can also be opened by pressing `Alt`-`Shift`-`,`.
 *
 * Note that this code, like MediaWiki Core, refers to the user's preferences as "options".
 * In this class, "preferences" refer to the user's preferences for CodeMirror, which
 * are stored as a single user 'option' in the database.
 *
 * See {@link CodeMirrorPreferences#modeIds modeIds} for possible values of preferences.
 */
class CodeMirrorPreferences extends CodeMirrorPanel {

	/**
	 * @param {CodeMirrorExtensionRegistry} extensionRegistry
	 * @param {string} mode The CodeMirror mode being used, e.g. 'mediawiki', 'javascript', etc.
	 * @param {CodeMirrorKeymap} cmKeymap Reference to the keymap instance.
	 * @param {boolean} [isVisualEditor=false] Whether the VE 2017 editor is being used.
	 * @fires CodeMirror~'ext.CodeMirror.preferences.ready'
	 */
	constructor( extensionRegistry, mode, cmKeymap, isVisualEditor = false ) {
		super();

		/** @type {string} */
		this.optionName = 'codemirror-preferences';

		/** @type {CodeMirrorExtensionRegistry} */
		this.extensionRegistry = extensionRegistry;

		/** @type {string} */
		this.mode = mode;

		/** @type {CodeMirrorKeymap} */
		this.keymap = cmKeymap;

		/** @type {boolean} */
		this.isVisualEditor = isVisualEditor;

		/** @type {mw.Api} */
		this.api = new mw.Api();

		/** @type {StateEffectType} */
		this.prefsToggleEffect = StateEffect.define();

		/** @type {StateField} */
		this.panelStateField = StateField.define( {
			create: () => true,
			update: ( value, transaction ) => {
				for ( const e of transaction.effects ) {
					if ( e.is( this.prefsToggleEffect ) ) {
						value = e.value;
					}
				}
				return value;
			},
			// eslint-disable-next-line arrow-body-style
			provide: ( stateField ) => {
				// eslint-disable-next-line arrow-body-style
				return showPanel.from( stateField, ( on ) => {
					return on ? () => this.panel : null;
				} );
			}
		} );

		/**
		 * The user's CodeMirror preferences.
		 *
		 * @type {Object<string, boolean>}
		 */
		this.preferences = this.fetchPreferences();

		/**
		 * Preferences that are disabled from being changed in the panel or dialog
		 * when {@link CodeMirrorPreferences#lockPreference lockPreference()} is called.
		 *
		 * @type {Set<string>}
		 */
		this.disabledPreferences = new Set();

		/**
		 * Preferences registered with
		 * {@link CodeMirrorPreferences#registerCallback registerCallback()}.
		 * These do not have an associated {@link Extension} and instead execute a callback function
		 * when the preference is changed.
		 *
		 * @type {Map<string, Function>}
		 */
		this.callbackPreferences = new Map();

		/**
		 * Preferences that are considered "slow" and indicated as such in the preferences dialog.
		 *
		 * @type {Set<string>}
		 */
		this.slowPreferences = new Set();

		/**
		 * Preferences only applicable to specific modes.
		 *
		 * @type {Map<string, string[]>} Preference names keyed by mode.
		 */
		this.modeSpecficPreferences = new Map();

		/**
		 * Fired just before {@link CodeMirrorPreferences} has been instantiated.
		 *
		 * @event CodeMirror~'ext.CodeMirror.preferences.ready'
		 * @param {CodeMirrorPreferences} preferences
		 */
		mw.hook( 'ext.CodeMirror.preferences.ready' ).fire( this );

		/**
		 * Preferences that are shown in the preferences panel, as defined by
		 * `$wgCodeMirrorPrimaryPreferences`. These "primary" preferences should:
		 * - Be commonly used,
		 * - Be easy to understand,
		 * - Have an immediate visual effect, and
		 * - Limited to a small subset to avoid consuming too much in-editor space.
		 *
		 * @type {string[]}
		 */
		this.primaryPreferences = Object.keys( this.mwConfigPrimary )
			.filter( ( prefName ) => !!this.mwConfigPrimary[ prefName ] );

		/**
		 * Configuration for the full preferences dialog.
		 *
		 * Each key is a section name having an i18n message key
		 * of the form `codemirror-prefs-section-<section>`.
		 *
		 * Values are arrays of preference names that belong to that section.
		 * Any preference not listed here will be shown in the "Other" section.
		 *
		 * @type {Object}
		 */
		this.dialogConfig = {
			lines: [
				'lineNumbering',
				'lineWrapping',
				'activeLine'
			],
			characters: [
				'specialChars',
				'whitespace',
				'trailingWhitespace'
			],
			'code-assistance': [
				'autocomplete',
				'codeFolding',
				'bracketMatching',
				'closeBrackets',
				'closeTags',
				'lint'
			]
		};
	}

	/**
	 * Possible values for CodeMirror preferences when stored in the database.
	 * - DISABLED means the preference is disabled for all modes.
	 * - ENABLED means the preference is enabled for all modes.
	 * - MEDIAWIKI_ONLY means the preference is enabled only for the mediawiki (wikitext) mode.
	 * - NON_MEDIAWIKI_ONLY means the preference is enabled for all non-mediawiki modes.
	 *
	 * @return {Object<string, number>}
	 */
	get modeIds() {
		return mw.config.get( 'extCodeMirrorConfig' ).preferenceModeIds;
	}

	/**
	 * @type {Object<string, number|Array>}
	 * @private
	 */
	get mwConfigDefaults() {
		return mw.config.get( 'extCodeMirrorConfig' ).defaultPreferences;
	}

	/**
	 * @type {Object<string, boolean>}
	 * @private
	 */
	get mwConfigPrimary() {
		return mw.config.get( 'extCodeMirrorConfig' ).primaryPreferences;
	}

	/**
	 * The default CodeMirror preferences in boolean format,
	 * derived from `$wgCodeMirrorPreferences` and taking into account the current mode.
	 *
	 * @return {Object<string, boolean>}
	 */
	getDefaultPreferences() {
		if ( this.defaultPreferences ) {
			return this.defaultPreferences;
		}

		const nsId = mw.config.get( 'wgNamespaceNumber' );
		const newDefaults = {};

		const { ENABLED, DISABLED, MEDIAWIKI_ONLY, NON_MEDIAWIKI_ONLY } = this.modeIds;
		for ( const prefName in this.mwConfigDefaults ) {
			const defaultValue = this.mwConfigDefaults[ prefName ] || DISABLED;
			if ( defaultValue === ENABLED || defaultValue === DISABLED ) {
				newDefaults[ prefName ] = !!defaultValue;
			} else if ( Array.isArray( defaultValue ) ) {
				// Assume an array of namespace IDs (integers) and CM modes (strings).
				const supportedNamespace = defaultValue.includes( nsId );
				const supportedMode = defaultValue.includes( this.mode );
				newDefaults[ prefName ] = supportedNamespace || supportedMode;
			} else {
				// defaultValue is a mode-specific value.
				newDefaults[ prefName ] = ( defaultValue === MEDIAWIKI_ONLY && this.mode === 'mediawiki' ) ||
					( defaultValue === NON_MEDIAWIKI_ONLY && this.mode !== 'mediawiki' );
			}
		}

		/**
		 * @type {Object<string, boolean>}
		 * @private
		 */
		this.defaultPreferences = newDefaults;

		return this.defaultPreferences;
	}

	/**
	 * Fetch the user's CodeMirror preferences from the user options API,
	 * or clientside storage for unnamed users.
	 *
	 * @return {Object<string, boolean>}
	 * @internal
	 */
	fetchPreferences() {
		const preferences = {};
		const fetchedPrefs = this.fetchPreferencesInternal();
		const defaultPrefs = this.getDefaultPreferences();
		const { ENABLED, MEDIAWIKI_ONLY, NON_MEDIAWIKI_ONLY } = this.modeIds;

		for ( const prefName in defaultPrefs ) {
			const fetchedPrefValue = fetchedPrefs[ prefName ];
			if ( fetchedPrefValue !== undefined ) {
				preferences[ prefName ] = fetchedPrefValue === ENABLED ||
					( fetchedPrefValue === MEDIAWIKI_ONLY && this.mode === 'mediawiki' ) ||
					( fetchedPrefValue === NON_MEDIAWIKI_ONLY && this.mode !== 'mediawiki' );
			} else {
				preferences[ prefName ] = defaultPrefs[ prefName ];
			}
		}

		return preferences;
	}

	/**
	 * @return {Object<string, number>}
	 * @internal
	 * @private
	 */
	fetchPreferencesInternal() {
		if ( mw.user.isNamed() ) {
			try {
				return JSON.parse( mw.user.options.get( this.optionName ) ) || {};
			} catch ( e ) {
				// Invalid JSON, or no preferences set.
				return {};
			}
		} else {
			return mw.storage.getObject( this.optionName ) || {};
		}
	}

	/**
	 * Set the given CodeMirror preference and update the user option in the database,
	 * or clientside storage for unnamed users. Preferences remain "sticky" only for
	 * the mediawiki (wikitext) mode, or to all non-mediawiki modes.
	 *
	 * @param {string} key
	 * @param {boolean} value
	 * @internal
	 */
	setPreference( key, value ) {
		if ( this.getPreference( key ) === value ) {
			// No change or pref is disabled, so do nothing.
			return;
		}
		this.preferences[ key ] = value;

		if ( this.disabledPreferences.has( key ) ) {
			// Preference is locked, so do not update storage or fire hooks.
			return;
		}

		/**
		 * Run any registered functional callbacks for this preference.
		 *
		 * @see CodeMirrorPreferences#callbackPreferences
		 */
		if ( this.callbackPreferences.has( key ) ) {
			this.callbackPreferences.get( key )( value );
		}

		const { ENABLED, DISABLED, MEDIAWIKI_ONLY, NON_MEDIAWIKI_ONLY } = this.modeIds;
		let storageObj = this.fetchPreferencesInternal();
		const oldPrefValue = storageObj[ key ] !== undefined ?
			storageObj[ key ] :
			this.mwConfigDefaults[ key ];
		const newPrefValue = Number( value );
		const isMediaWiki = this.mode === 'mediawiki';

		switch ( oldPrefValue ) {
			case MEDIAWIKI_ONLY:
				if ( newPrefValue === ENABLED && !isMediaWiki ) {
					// Now enabled for all modes, so set to `ENABLED`.
					storageObj[ key ] = ENABLED;
				} else if ( newPrefValue === DISABLED && isMediaWiki ) {
					// Now disabled for all modes, so set to `DISABLED`.
					storageObj[ key ] = DISABLED;
				}
				break;
			case NON_MEDIAWIKI_ONLY:
				if ( newPrefValue === ENABLED && isMediaWiki ) {
					// Now enabled for all modes, so set to `ENABLED`.
					storageObj[ key ] = ENABLED;
				} else if ( newPrefValue === DISABLED && !isMediaWiki ) {
					// Now disabled for all modes, so set to `DISABLED`.
					storageObj[ key ] = DISABLED;
				}
				break;
			case ENABLED:
				if ( newPrefValue === DISABLED ) {
					// Become disabled in one of the modes -> switch to the opposite "only" value.
					storageObj[ key ] = isMediaWiki ? NON_MEDIAWIKI_ONLY : MEDIAWIKI_ONLY;
				}
				break;
			case DISABLED:
				if ( newPrefValue === ENABLED ) {
					// Become enabled in one of the modes -> switch to the opposite "only" value.
					storageObj[ key ] = isMediaWiki ? MEDIAWIKI_ONLY : NON_MEDIAWIKI_ONLY;
				}
				break;
			default:
				// Old preference was not set.
				storageObj[ key ] = newPrefValue ?
					( isMediaWiki ? MEDIAWIKI_ONLY : NON_MEDIAWIKI_ONLY ) :
					( isMediaWiki ? NON_MEDIAWIKI_ONLY : MEDIAWIKI_ONLY );
		}

		// Mode-specific preferences can be normalized to ENABLED or DISABLED when toggled.
		if ( this.modeSpecficPreferences.has( this.mode ) &&
			this.modeSpecficPreferences.get( this.mode ).includes( key ) &&
			( storageObj[ key ] === MEDIAWIKI_ONLY || storageObj[ key ] === NON_MEDIAWIKI_ONLY )
		) {
			storageObj[ key ] = value ? ENABLED : DISABLED;
		}

		// Loop through all preferences and remove any that match the defaults
		// in order to keep the storage footprint at a minimum.
		for ( const prefName in this.mwConfigDefaults ) {
			if ( storageObj[ prefName ] === this.mwConfigDefaults[ prefName ] ) {
				delete storageObj[ prefName ];
			}
		}

		// If preferences wholly match the defaults, delete the user option.
		if ( Object.keys( storageObj ).length === 0 ) {
			storageObj = null;
		}

		this.setPreferencesInternal( storageObj );
		this.firePreferencesApplyHook( key, value );
	}

	/**
	 * @param {Object} storageObj
	 * @internal
	 * @private
	 */
	setPreferencesInternal( storageObj ) {
		const stringified = storageObj === null ? null : JSON.stringify( storageObj );
		mw.user.options.set( this.optionName, stringified || null );
		if ( mw.user.isNamed() ) {
			this.api.saveOption( this.optionName, stringified );
		} else {
			mw.storage.setObject( this.optionName, storageObj );
		}
	}

	/**
	 * Lock a preference to the given value, disabling the option in
	 * the preferences panel and dialog. The user option in the database
	 * is **not** changed.
	 *
	 * This is useful for integrations that need to disable incompatible extensions.
	 *
	 * @param {string} prefName
	 * @param {EditorView} [view]
	 * @param {boolean} [force=false] Force the extension to be enabled or disabled.
	 * @stable to call
	 */
	lockPreference( prefName, view, force = false ) {
		if ( view ) {
			this.extensionRegistry.toggle( prefName, view, force );
		}
		this.disabledPreferences.add( prefName );
		this.setPreference( prefName, force );
		this.firePreferencesApplyHook( prefName, force );
	}

	/**
	 * @param {string} prefName
	 * @param {boolean} [value]
	 * @fires CodeMirror~'ext.CodeMirror.preferences.apply'
	 * @internal
	 */
	firePreferencesApplyHook( prefName, value ) {
		/**
		 * Fired when a CodeMirror preference is changed or initially applied in a session.
		 * The preference may not have been saved to the database yet.
		 *
		 * @event CodeMirror~'ext.CodeMirror.preferences.apply'
		 * @param {string} prefName
		 * @param {boolean} prefValue
		 */
		mw.hook( 'ext.CodeMirror.preferences.apply' ).fire(
			prefName,
			value === undefined ? this.getPreference( prefName ) : value
		);
	}

	/**
	 * Get the value of the given CodeMirror preference.
	 *
	 * @param {string} prefName
	 * @return {boolean}
	 * @stable to call
	 */
	getPreference( prefName ) {
		// First check the preference explicitly set by the user.
		// For now, we don't allow CodeMirror preferences to override
		// config settings in the 2017 editor, since there's no UI to set them.
		if ( !this.isVisualEditor && this.preferences[ prefName ] !== undefined ) {
			return this.preferences[ prefName ];
		}

		// Otherwise, go by the defaults.
		return this.getDefaultPreferences()[ prefName ];
	}

	/**
	 * Check if the user has any preferences that differ from the defaults.
	 * This is used to determine whether EventLogging should happen.
	 *
	 * @return {boolean}
	 * @internal
	 */
	hasNonDefaultPreferences() {
		for ( const prefName in this.preferences ) {
			if ( !!this.preferences[ prefName ] !== !!this.getDefaultPreferences()[ prefName ] ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Register an {@link Extension} with {@link CodeMirrorExtensionRegistry}
	 * and enable it if the corresponding preference is set.
	 *
	 * @param {string} name
	 * @param {Extension} extension
	 * @param {EditorView} view
	 * @param {Object} [config]
	 * @param {boolean} [config.slow] Setting to true will indicate that the feature
	 *   is slow in the preferences dialog.
	 * @param {string|null} [config.mode] Indicates the preference only applies to a specific
	 *   mode, and storage values will be normalized to `ENABLED` or `DISABLED` when toggled.
	 * @internal
	 */
	registerExtension( name, extension, view, config = { slow: false, mode: null } ) {
		this.extensionRegistry.register( name, extension, view, this.getPreference( name ) );
		if ( config.slow ) {
			this.slowPreferences.add( name );
		}
		if ( config.mode ) {
			const existingPrefs = this.modeSpecficPreferences.get( config.mode ) || [];
			this.modeSpecficPreferences.set( config.mode, existingPrefs.concat( [ name ] ) );
		}
		this.firePreferencesApplyHook( name );
	}

	/**
	 * Instead of an {@link Extension}, register a callback function that is executed
	 * when the preference value is changed. The callback is executed immediately if
	 * the preference is already set when registered.
	 *
	 * @param {string} name
	 * @param {Function} callback Function that takes the new preference value.
	 * @param {EditorView} view
	 * @param {Object} [config]
	 * @param {boolean} [config.slow] Setting to true will indicate that the feature
	 *   is slow in the preferences dialog.
	 * @param {string|null} [config.mode] Indicates the preference only applies to a specific
	 *   mode, and storage values will be normalized to `ENABLED` or `DISABLED` when toggled.
	 * @internal
	 */
	registerCallback( name, callback, view, config = { slow: false, mode: null } ) {
		// Register a dummy extension.
		this.extensionRegistry.register( name, [], view, this.getPreference( name ) );
		this.callbackPreferences.set( name, callback );
		if ( this.getPreference( name ) ) {
			callback( true );
		}
		if ( config.slow ) {
			this.slowPreferences.add( name );
		}
		if ( config.mode ) {
			const existingPrefs = this.modeSpecficPreferences.get( config.mode ) || [];
			this.modeSpecficPreferences.set( config.mode, existingPrefs.concat( [ name ] ) );
		}
	}

	/**
	 * Toggle an {@link Extension} on or off with {@link CodeMirrorExtensionRegistry}
	 * and update the preference.
	 *
	 * @param {string} name
	 * @param {EditorView} view
	 * @internal
	 */
	toggleExtension( name, view ) {
		const toEnable = !this.getPreference( name );
		this.extensionRegistry.toggle( name, view, toEnable );
		this.setPreference( name, toEnable );
	}

	/**
	 * @inheritDoc
	 */
	get extension() {
		return [
			keymap.of( [
				// Toggling the preferences panel.
				{ key: 'Mod-Shift-,', run: ( view ) => this.toggle( view, true ) },
				// Toggling the full preferences dialog.
				{ key: 'Alt-Shift-,', run: ( view ) => this.showPreferencesDialog( view ) }
			] ),
			// At this point the registry contains only extensions managed by CodeMirrorPreferences.
			this.extensionRegistry.names.map( ( name ) => {
				// Only apply the Extension if the preference (or default pref) is set.
				if ( this.getPreference( name ) ) {
					this.firePreferencesApplyHook( name );
					return this.extensionRegistry.get( name );
				}
				return this.extensionRegistry.getCompartment( name ).of( [] );
			} )
		];
	}

	/**
	 * @inheritDoc
	 */
	get panel() {
		const container = document.createElement( 'div' );
		container.className = 'cm-mw-preferences-panel cm-mw-panel';
		container.addEventListener( 'keydown', this.onKeydownPanel.bind( this ) );

		const heading = document.createElement( 'div' );
		heading.textContent = mw.msg( 'codemirror-prefs-title' );
		heading.appendChild( this.getHelpLinks() );
		container.appendChild(
			this.getCheckboxesFieldset(
				this.primaryPreferences,
				heading
			)
		);

		const closeBtn = this.getButton( 'codemirror-close', { icon: 'close', iconOnly: true } );
		closeBtn.classList.add( 'cdx-button--weight-quiet', 'cm-mw-panel-close' );
		container.appendChild( closeBtn );
		closeBtn.addEventListener( 'click', () => {
			this.toggle( this.view, false );
		} );

		/**
		 * Fired when the preferences panel is opened or closed.
		 *
		 * @event CodeMirror~'ext.CodeMirror.preferences.display'
		 * @param {HTMLDivElement|null} container The preferences panel container,
		 *   or null if the panel is being closed.
		 * @internal
		 */
		mw.hook( 'ext.CodeMirror.preferences.display' ).fire( container );

		return {
			dom: container,
			top: true
		};
	}

	/**
	 * @return {HTMLSpanElement}
	 * @private
	 */
	getHelpLinks() {
		const helpSpan = document.createElement( 'span' );
		helpSpan.className = 'cm-mw-panel--help';
		const helpLink = document.createElement( 'a' );
		helpLink.href = 'https://www.mediawiki.org/wiki/Special:MyLanguage/Help:Extension:CodeMirror';
		helpLink.target = '_blank';
		helpLink.textContent = mw.msg( 'codemirror-prefs-help' ).toLowerCase();
		// Click listener added in CodeMirrorKeymap since we don't have a CodeMirror instance here.
		const shortcutLink = document.createElement( 'a' );
		shortcutLink.className = 'cm-mw-panel--kbd-help';
		shortcutLink.href = 'https://www.mediawiki.org/wiki/Special:MyLanguage/Help:Extension:CodeMirror#Keyboard_shortcuts';
		shortcutLink.textContent = mw.msg( 'codemirror-keymap-help-title' ).toLowerCase();
		shortcutLink.onclick = ( e ) => e.preventDefault();
		shortcutLink.title = this.keymap.getTitleWithShortcut(
			this.keymap.keymapHelpRegistry.other.help
		);
		const fullPrefsLink = document.createElement( 'a' );
		fullPrefsLink.href = 'https://www.mediawiki.org/wiki/Special:MyLanguage/Help:Extension:CodeMirror#Features';
		fullPrefsLink.textContent = mw.msg( 'codemirror-prefs-panel-full' ).toLowerCase();
		fullPrefsLink.onclick = ( e ) => {
			e.preventDefault();
			this.showPreferencesDialog( this.view );
		};
		fullPrefsLink.title = this.keymap.getTitleWithShortcut(
			this.keymap.keymapHelpRegistry.other.fullPreferences
		);
		helpSpan.append(
			' ',
			mw.msg( 'parentheses-start' ),
			helpLink,
			mw.msg( 'pipe-separator' ),
			shortcutLink,
			mw.msg( 'pipe-separator' ),
			fullPrefsLink,
			mw.msg( 'parentheses-end' )
		);
		return helpSpan;
	}

	/**
	 * Get a fieldset containing checkboxes for the given preferences.
	 *
	 * @param {string[]} prefNames Names of preferences to include.
	 * @param {string|HTMLElement} [title] Title of the fieldset.
	 * @return {HTMLFieldSetElement}
	 * @private
	 */
	getCheckboxesFieldset(
		prefNames,
		title = mw.msg( 'codemirror-prefs-title' )
	) {
		// Only include registered extensions.
		prefNames = prefNames.filter(
			( name ) => this.extensionRegistry.names.includes( name ) &&
				this.preferences[ name ] !== undefined
		);
		const wrappers = [];
		for ( const prefName of prefNames ) {
			const [ wrapper, input ] = this.getCheckbox(
				prefName,
				`codemirror-prefs-${ prefName.toLowerCase() }`,
				this.getPreference( prefName )
			);
			if ( this.disabledPreferences.has( prefName ) ) {
				input.disabled = true;
			}
			if ( this.slowPreferences.has( prefName ) ) {
				const slowSpan = document.createElement( 'span' );
				slowSpan.className = 'cm-mw-slow-feature';
				slowSpan.textContent = mw.msg( 'parentheses', mw.msg( 'codemirror-potentially-slow' ) );
				const label = wrapper.querySelector( 'label' );
				label.append( ' ' );
				label.appendChild( slowSpan );
			}
			wrappers.push( wrapper );
		}
		return this.getFieldset( title, ...wrappers );
	}

	/**
	 * Toggle display of the preferences panel.
	 *
	 * @param {EditorView} view
	 * @param {boolean} [force] Force the panel to open or close.
	 * @return {boolean}
	 */
	toggle( view, force ) {
		this.view = view;

		// If there is no primary CodeMirror instance (e.g. on Special:SecurePoll/translate).
		if ( !view.dom.isConnected ) {
			this.showPreferencesDialog( view );
			return true;
		}

		const effects = [];
		let bool;

		// Add the panel state field to the state if it doesn't exist.
		if ( !this.view.state.field( this.panelStateField, false ) ) {
			effects.push( StateEffect.appendConfig.of( [ this.panelStateField ] ) );
			bool = true;
		} else {
			bool = !this.view.state.field( this.panelStateField );
		}
		if ( typeof force === 'boolean' ) {
			bool = force;
		}
		effects.push( this.prefsToggleEffect.of( bool ) );
		this.view.dispatch( { effects } );

		// If the panel is being opened, focus the first input.
		if ( bool ) {
			this.view.dom.querySelector(
				'.cm-mw-preferences-panel input:first-child'
			).focus();
		} else {
			mw.hook( 'ext.CodeMirror.preferences.display' ).fire( null );
		}

		return true;
	}

	/**
	 * Handle keydown events on the preferences panel.
	 *
	 * @param {KeyboardEvent} event
	 */
	onKeydownPanel( event ) {
		if ( event.key === 'Escape' ) {
			event.preventDefault();
			this.toggle( this.view, false );
			this.view.focus();
		} else if ( event.key === 'Enter' ) {
			event.preventDefault();
		}
	}

	/**
	 * Show the dialog with all available preferences.
	 *
	 * @param {EditorView} view
	 * @return {boolean}
	 */
	showPreferencesDialog( view ) {
		if ( this.dialog ) {
			this.animateDialog( true );
			return true;
		}

		this.view = view;

		const fieldsets = [];
		const sectionPrefs = [];
		for ( const [ section, prefs ] of Object.entries( this.dialogConfig ) ) {
			sectionPrefs.push( ...prefs );
			const fieldset = this.getCheckboxesFieldset(
				prefs,
				// Message here may include but are not limited to:
				// * codemirror-prefs-section-lines
				// * codemirror-prefs-section-characters
				// * codemirror-prefs-section-code-assistance
				// * codemirror-prefs-section-other
				mw.msg( `codemirror-prefs-section-${ section }` )
			);
			if ( fieldset.children.length > 1 ) {
				fieldsets.push( fieldset );
			}
		}

		// Add a fieldset for the remaining preferences.
		const otherPrefs = Object.keys( this.preferences ).filter(
			( name ) => !sectionPrefs.includes( name ) &&
				this.extensionRegistry.isRegistered( name, view )
		);
		if ( otherPrefs.length > 0 ) {
			fieldsets.push(
				this.getCheckboxesFieldset(
					otherPrefs,
					mw.msg( 'codemirror-prefs-section-other' )
				)
			);
		}

		const resetButton = this.getButton(
			'codemirror-prefs-reset',
			{ action: 'destructive', weight: 'quiet' }
		);
		resetButton.addEventListener( 'click', () => {
			for ( const prefName in this.getDefaultPreferences() ) {
				if ( !this.extensionRegistry.isRegistered( prefName, view ) ) {
					continue;
				}
				const defaultPref = this.getDefaultPreferences()[ prefName ];
				this.setPreference( prefName, defaultPref );
				this.extensionRegistry.toggle( prefName, view, defaultPref );
			}
		} );

		this.dialog = this.showDialog(
			'codemirror-prefs-title',
			'preferences',
			fieldsets,
			resetButton
		);

		return true;
	}

	/**
	 * @inheritDoc
	 */
	getCheckbox( name, label, checked ) {
		const [ wrapper, input ] = super.getCheckbox( name, label, checked );
		input.addEventListener( 'change', () => {
			this.extensionRegistry.toggle( name, this.view, input.checked );
			this.setPreference( name, input.checked );
		} );
		// Update the checked state when the preference is changed.
		mw.hook( 'ext.CodeMirror.preferences.apply' ).add( ( pref, enabled ) => {
			if ( pref === name ) {
				input.checked = enabled;
			}
		} );
		return [ wrapper, input ];
	}
}

module.exports = CodeMirrorPreferences;
