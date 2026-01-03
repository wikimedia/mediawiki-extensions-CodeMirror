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
		 * @type {Object}
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
		 * @type {Map<string>}
		 */
		this.callbackPreferences = new Map();

		/**
		 * Preferences that are considered "slow" and indicated as such in the preferences dialog.
		 *
		 * @type {Set<string>}
		 */
		this.slowPreferences = new Set();

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
				'whitespace'
			],
			'code-assistance': [
				'autocomplete',
				'codeFolding',
				'bracketMatching',
				'closeBrackets',
				'lint'
			]
		};
	}

	/**
	 * @type {Object}
	 * @private
	 */
	get mwConfigDefaults() {
		return mw.config.get( 'extCodeMirrorConfig' ).defaultPreferences;
	}

	get mwConfigPrimary() {
		return mw.config.get( 'extCodeMirrorConfig' ).primaryPreferences;
	}

	/**
	 * The default CodeMirror preferences, as defined by `$wgCodeMirrorPreferences`
	 * and taking into account the page namespace and the CodeMirror mode.
	 *
	 * @return {Object}
	 */
	getDefaultPreferences() {
		if ( this.defaultPreferences ) {
			return this.defaultPreferences;
		}

		const nsId = mw.config.get( 'wgNamespaceNumber' );
		const newDefaults = {};

		Object.keys( this.mwConfigDefaults ).forEach( ( prefName ) => {
			const prefValue = this.mwConfigDefaults[ prefName ] || false;

			if ( typeof prefValue === 'boolean' ) {
				newDefaults[ prefName ] = prefValue;
				return;
			}

			// Assume an array of namespace IDs (integers) and CM modes (strings).
			const supportedNamespace = prefValue.includes( nsId );
			const supportedMode = prefValue.includes( this.mode );

			newDefaults[ prefName ] = supportedNamespace || supportedMode;
		} );

		/**
		 * @type {Object}
		 * @private
		 */
		this.defaultPreferences = newDefaults;

		return this.defaultPreferences;
	}

	/**
	 * Fetch the user's CodeMirror preferences from the user options API,
	 * or clientside storage for unnamed users.
	 *
	 * @return {Object}
	 */
	fetchPreferences() {
		const storageObj = Object.assign(
			{},
			this.getDefaultPreferences(),
			this.fetchPreferencesInternal()
		);

		// Convert binary representation to boolean.
		const preferences = {};
		for ( const prefName in storageObj ) {
			preferences[ prefName ] = !!storageObj[ prefName ];
		}
		return preferences;
	}

	/**
	 * @return {Object}
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
	 * or clientside storage for unnamed users.
	 *
	 * @param {string} key
	 * @param {boolean} value
	 * @internal
	 */
	setPreference( key, value ) {
		if ( this.preferences[ key ] === value ) {
			// No change, so do nothing.
			return;
		}
		this.preferences[ key ] = value;

		if ( this.callbackPreferences.has( key ) ) {
			this.callbackPreferences.get( key )( value );
		}

		// Only save the preferences that differ from the defaults,
		// and use a binary representation for storage. This is to prevent
		// bloat of the user_properties table (T54777).
		let storageObj = {};
		for ( const prefName in this.preferences ) {
			if ( !!this.preferences[ prefName ] !== !!this.getDefaultPreferences()[ prefName ] || (
				// Always store preferences that have namespace or CM mode restrictions and
				// have been overridden by the user, even if they match the default for this page.
				this.fetchPreferencesInternal()[ prefName ] !== undefined &&
				Array.isArray( this.mwConfigDefaults[ prefName ] )
			) ) {
				storageObj[ prefName ] = this.preferences[ prefName ] ? 1 : 0;
			}
		}

		// If preferences match the defaults, delete the user option.
		if ( Object.keys( storageObj ).length === 0 ) {
			storageObj = null;
		}

		this.setPreferencesInternal( storageObj );
		this.firePreferencesApplyHook( key );
	}

	/**
	 * @param {Object} storageObj
	 * @internal
	 * @private
	 */
	setPreferencesInternal( storageObj ) {
		const stringified = storageObj === null ? null : JSON.stringify( storageObj );
		mw.user.options.set( this.optionName, stringified );
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
	 * @param {EditorView} view
	 * @param {boolean} [force=false] Force the extension to be enabled or disabled.
	 * @stable to call
	 */
	lockPreference( prefName, view, force = false ) {
		this.extensionRegistry.toggle( prefName, view, force );
		this.preferences[ prefName ] = force;
		this.disabledPreferences.add( prefName );
		// Ensure any child instances also have the preference disabled.
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
	 * @param {boolean} [slow=false] Setting to true will indicate that
	 *   the feature is slow in the preferences dialog.
	 * @internal
	 */
	registerExtension( name, extension, view, slow = false ) {
		this.extensionRegistry.register( name, extension, view, this.getPreference( name ) );
		if ( slow ) {
			this.slowPreferences.add( name );
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
	 * @param {boolean} [slow=false] Setting to true will indicate that
	 *   the feature is slow in the preferences dialog.
	 * @internal
	 */
	registerCallback( name, callback, view, slow = false ) {
		// Register a dummy extension.
		this.extensionRegistry.register( name, [], view, this.getPreference( name ) );
		this.callbackPreferences.set( name, callback );
		if ( this.getPreference( name ) ) {
			callback( true );
		}
		if ( slow ) {
			this.slowPreferences.add( name );
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
			for ( const prefName of Object.keys( this.getDefaultPreferences() ) ) {
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
