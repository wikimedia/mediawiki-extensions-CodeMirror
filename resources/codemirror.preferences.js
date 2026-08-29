const {
	EditorView,
	Extension,
	keymap
} = require( 'ext.CodeMirror.lib' );
const CodeMirrorCodex = require( './codemirror.codex.js' );
require( './ext.CodeMirror.data.js' );

/**
 * @typedef {boolean|string} CodeMirrorPreferences~PrefValue
 */

/**
 * CodeMirrorPreferences is a dialog that allows users to configure CodeMirror preferences.
 * It is opened by pressing `Ctrl`-`Shift`-`,` (or `Command`-`Shift`-`,` on macOS).
 *
 * Note that this code, like MediaWiki Core, refers to the user's preferences as "options".
 * In this class, "preferences" refer to the user's preferences for CodeMirror, which
 * are stored as a single user 'option' in the database.
 */
class CodeMirrorPreferences extends CodeMirrorCodex {

	/**
	 * @param {CodeMirrorExtensionRegistry} extensionRegistry
	 * @param {string} mode The CodeMirror mode being used, e.g. 'mediawiki', 'javascript', etc.
	 * @param {CodeMirrorKeymap} cmKeymap Reference to the keymap instance.
	 * @fires CodeMirror~'ext.CodeMirror.preferences.ready'
	 */
	constructor( extensionRegistry, mode, cmKeymap ) {
		super();

		/** @type {CodeMirrorExtensionRegistry} */
		this.extensionRegistry = extensionRegistry;

		/** @type {string} */
		this.mode = mode;

		/** @type {CodeMirrorKeymap} */
		this.keymap = cmKeymap;

		/** @type {mw.Api} */
		this.api = new mw.Api();

		/** @type {EditorView} */
		this.view = undefined;

		/**
		 * The user's CodeMirror preferences.
		 *
		 * @type {Object<string, PrefValue>}
		 */
		this.preferences = this.fetchPreferences();

		/**
		 * Preferences that are disabled from being changed in the preferences dialog
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
		 * The Map object is keyed by preference name, with values being the callback function.
		 *
		 * @type {Map}
		 */
		this.callbackPreferences = new Map();

		/**
		 * Preferences that are considered "slow" and indicated as such in the preferences dialog.
		 *
		 * @type {Set<string>}
		 */
		this.slowPreferences = new Set();

		/**
		 * If any feature calls for a form element that's not just a checkbox,
		 * it needs to be listed here. Key is the preference name, and the value
		 * is a {@link FormSpecifier form specifier}.
		 *
		 * @type {Map<string, FormSpecifier>}
		 */
		this.formSpecification = new Map();

		/**
		 * Fired just before {@link CodeMirrorPreferences} has been instantiated.
		 *
		 * @event CodeMirror~'ext.CodeMirror.preferences.ready'
		 * @param {CodeMirrorPreferences} preferences
		 */
		mw.hook( 'ext.CodeMirror.preferences.ready' ).fire( this );

		/**
		 * Configuration for the preferences dialog.
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
			appearance: [
				'theme'
			],
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

		// Temporary migration of 'usecodemirror-colorblind' option to 'theme' preference.
		this.migrateColorblindUserOption();
	}

	/**
	 * @return {Object<string, PrefValue|Array>}
	 * @private
	 */
	getMwConfigDefaults() {
		if ( this.mode === 'mediawiki' ) {
			return mw.config.get( 'extCodeMirrorConfig' ).defaultPreferences;
		}
		return mw.config.get( 'extCodeMirrorConfig' ).defaultPreferencesCode;
	}

	/**
	 * Get the name of the user option where CodeMirror preferences are stored for the current mode.
	 *
	 * @return {string}
	 * @private
	 */
	getOptionName() {
		return this.mode === 'mediawiki' ? 'codemirror-preferences' : 'codemirror-preferences-code';
	}

	/**
	 * The default CodeMirror preferences in boolean format, derived from
	 * `$wgCodeMirrorDefaultPreferences` or `$wgCodeMirrorDefaultPreferencesCode`
	 * depending on the current mode.
	 *
	 * @return {Object<string, PrefValue>}
	 */
	getDefaultPreferences() {
		if ( this.defaultPreferences ) {
			return this.defaultPreferences;
		}

		const nsId = mw.config.get( 'wgNamespaceNumber' );
		const newDefaults = {};

		for ( const prefName in this.getMwConfigDefaults() ) {
			const defaultValue = this.getMwConfigDefaults()[ prefName ];
			const prefValue = defaultValue === undefined ? false : defaultValue;
			if ( typeof prefValue === 'boolean' || typeof prefValue === 'string' ) {
				newDefaults[ prefName ] = prefValue;
				continue;
			}
			// Assume an array of namespace IDs (integers) and CM modes (strings).
			const supportedNamespace = prefValue.includes( nsId );
			const supportedMode = prefValue.includes( this.mode );
			newDefaults[ prefName ] = supportedNamespace || supportedMode;
		}

		/**
		 * @type {Object<string, PrefValue>}
		 * @private
		 */
		this.defaultPreferences = newDefaults;

		return this.defaultPreferences;
	}

	/**
	 * Fetch the user's CodeMirror preferences from the user options API,
	 * or clientside storage for unnamed users.
	 *
	 * @return {Object<string, PrefValue>}
	 * @internal
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
			// B/c with older "mode ID" system; 2 = mediawiki-only, 3 = all other modes.
			let prefValue = storageObj[ prefName ];
			if ( prefValue === 2 ) {
				prefValue = this.mode === 'mediawiki';
			} else if ( prefValue === 3 ) {
				prefValue = this.mode !== 'mediawiki';
			}

			preferences[ prefName ] = typeof prefValue === 'string' ? prefValue : !!prefValue;
		}

		return preferences;
	}

	/**
	 * @return {Object<string, number|string>}
	 * @internal
	 * @private
	 */
	fetchPreferencesInternal() {
		if ( mw.user.isNamed() ) {
			try {
				return JSON.parse( mw.user.options.get( this.getOptionName() ) ) || {};
			} catch ( e ) {
				// Invalid JSON, or no preferences set.
				return {};
			}
		} else {
			return mw.storage.getObject( this.getOptionName() ) || {};
		}
	}

	/**
	 * Migrate the 'usecodemirror-colorblind' user option to the 'theme' CM preference.
	 * After another MW release or two, it may be fine to remove this method.
	 *
	 * @private
	 */
	migrateColorblindUserOption() {
		if ( !mw.user.isNamed() || this.mode !== 'mediawiki' ) {
			return;
		}
		if ( mw.user.options.get( 'usecodemirror-colorblind' ) > 0 ) {
			this.setPreference( 'theme', 'colorblind' );
			// Delete the user option from the DB.
			this.saveUserOptionInternal( 'usecodemirror-colorblind', null );
		}
	}

	/**
	 * Set the given CodeMirror preference and update the user option in the database,
	 * or clientside storage for unnamed users. Preferences remain "sticky" only for
	 * the mediawiki (wikitext) mode, or to all non-mediawiki modes.
	 *
	 * The `value` is either a boolean (enabled or disabled), or a string. The string can
	 * be of any form, such serialized JSON. Each individual feature is responsible for
	 * decoding or normalizing the value, if necessary.
	 *
	 * @param {string} key
	 * @param {PrefValue} value A string value indicates enabled but with the given value.
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

		// Only save the preferences that differ from the defaults,
		// and use a binary representation for booleans.
		const storedPreferences = this.fetchPreferencesInternal();
		let storageObj = {};
		for ( const prefName in this.preferences ) {
			// A locked preference holds the forced value rather than the user's, so serializing
			// it would overwrite what they set elsewhere. Carry the stored value through instead.
			if ( this.disabledPreferences.has( prefName ) ) {
				if ( storedPreferences[ prefName ] !== undefined ) {
					storageObj[ prefName ] = storedPreferences[ prefName ];
				}
				continue;
			}
			if ( this.preferences[ prefName ] !== this.getDefaultPreferences()[ prefName ] ) {
				storageObj[ prefName ] = typeof this.preferences[ prefName ] === 'string' ?
					this.preferences[ prefName ] :
					Number( !!this.preferences[ prefName ] );
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
		if ( mw.user.isNamed() ) {
			this.saveUserOptionInternal( this.getOptionName(), stringified );
		} else {
			mw.user.options.set( this.getOptionName(), stringified || null );
			mw.storage.setObject( this.getOptionName(), storageObj );
		}
	}

	/**
	 * Update the given user option, overriding the global user option if applicable.
	 * All CodeMirror user options should also be listed in "GlobalPreferencesAutoPrefs"
	 * in extension.json so that they are auto-globals (T428887).
	 *
	 * @param {string} optionname
	 * @param {string|number|null} optionvalue
	 * @internal
	 */
	saveUserOptionInternal( optionname, optionvalue ) {
		this.api.saveOption( optionname, optionvalue, { global: 'update' } );
		mw.user.options.set( optionname, optionvalue || null );
	}

	/**
	 * Lock a preference to the given value, disabling the option in
	 * the preferences dialog. The user option in the database
	 * is **not** changed.
	 *
	 * This is useful for integrations that need to disable incompatible extensions.
	 *
	 * @param {string} prefName
	 * @param {Editor} [editor]
	 * @param {PrefValue} [force=false] Force the extension to be enabled or
	 *   disabled (boolean), or enabled with a given value (string).
	 * @stable to call
	 */
	lockPreference( prefName, editor, force = false ) {
		if ( editor ) {
			this.extensionRegistry.toggle( prefName, editor, force );
		}
		this.disabledPreferences.add( prefName );
		this.setPreference( prefName, force );
		this.firePreferencesApplyHook( prefName, force );
	}

	/**
	 * @param {string} prefName
	 * @param {PrefValue} [value]
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
		 * @param {PrefValue} prefValue
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
	 * @return {PrefValue}
	 * @stable to call
	 */
	getPreference( prefName ) {
		// First check the preference explicitly set by the user.
		if ( this.preferences[ prefName ] !== undefined ) {
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
			if ( this.preferences[ prefName ] !== this.getDefaultPreferences()[ prefName ] ) {
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
	 * @param {Editor} editor
	 * @param {boolean} [slow=false] Setting to true will indicate that
	 *   the feature is "potentially slow" in the preferences dialog.
	 * @internal
	 */
	registerExtension( name, extension, editor, slow = false ) {
		this.extensionRegistry.register( name, extension, editor, !!this.getPreference( name ) );
		if ( slow ) {
			this.slowPreferences.add( name );
		}
		this.firePreferencesApplyHook( name );
	}

	/**
	 * Register and enable an {@link Extension} with {@link CodeMirrorExtensionRegistry}
	 * from a {@link CodeMirrorExtensionRegistry#reconfigValueMap reconfiguration value}
	 * retrieved from the preference value.
	 *
	 * This can be used for initially registering features that use non-boolean values.
	 *
	 * @param {string} name
	 * @param {Editor} editor
	 * @param {boolean} [slow=false] Setting to true will indicate that
	 *   the feature is "potentially slow" in the preferences dialog.
	 * @internal
	 */
	registerExtensionFromValueMap( name, editor, slow = false ) {
		const prefValue = this.getPreference( name );
		if ( typeof prefValue !== 'string' ) {
			throw new Error(
				`[CodeMirror] Registering "${ name }" from reconfig ` +
				'value map with a non-string value'
			);
		}
		this.extensionRegistry.registerFromValueMap( name, editor, prefValue );
		if ( slow ) {
			this.slowPreferences.add( name );
		}
		this.firePreferencesApplyHook( name, prefValue );
	}

	/**
	 * Instead of an {@link Extension}, register a callback function that is executed
	 * when the preference value is changed. The callback is executed immediately if
	 * the preference is already set when registered.
	 *
	 * @param {string} name
	 * @param {Function} callback Function that takes the new preference value.
	 * @param {Editor} editor
	 * @param {boolean} [slow=false] Setting to true will indicate that
	 *   the feature is "potentially slow" in the preferences dialog.
	 * @internal
	 */
	registerCallback( name, callback, editor, slow = false ) {
		// Register a dummy extension.
		this.extensionRegistry.register( name, [], editor, this.getPreference( name ) );
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
	 * @param {Editor} editor
	 * @internal
	 */
	toggleExtension( name, editor ) {
		const prefValue = this.getPreference( name );
		if ( typeof prefValue !== 'boolean' ) {
			throw new Error( `[CodeMirror] Toggling the non-boolean preference "${ prefValue }"` );
		}
		const toEnable = !this.getPreference( name );
		this.extensionRegistry.toggle( name, editor, toEnable );
		this.setPreference( name, toEnable );
	}

	/**
	 * @inheritDoc
	 */
	get extension() {
		return [
			keymap.of( [
				{ key: 'Mod-Shift-,', run: ( view ) => this.showPreferencesDialog( view ) }
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
	 * @return {HTMLDivElement}
	 * @private
	 */
	getHelpLinks() {
		const helpDiv = document.createElement( 'div' );
		helpDiv.className = 'cm-mw-dialog__help';
		const helpLink = document.createElement( 'a' );
		helpLink.href = 'https://www.mediawiki.org/wiki/Special:MyLanguage/Help:Extension:CodeMirror';
		helpLink.target = '_blank';
		helpLink.textContent = mw.msg( 'codemirror-prefs-help' );
		const shortcutLink = document.createElement( 'a' );
		shortcutLink.href = 'https://www.mediawiki.org/wiki/Special:MyLanguage/Help:Extension:CodeMirror#Keyboard_shortcuts';
		shortcutLink.textContent = mw.msg( 'codemirror-prefs-keymap' );
		shortcutLink.onclick = ( e ) => {
			e.preventDefault();
			this.keymap.showHelpDialog();
		};
		shortcutLink.title = this.keymap.getTitleWithShortcut(
			this.keymap.keymapHelpRegistry.other.help
		);
		helpDiv.append( helpLink, '·', shortcutLink );
		return helpDiv;
	}

	/**
	 * Get a fieldset containing form fields (namely checkboxes) for the given preferences.
	 *
	 * @param {string[]} prefNames Names of preferences to include.
	 * @param {string|HTMLElement} [title] Title of the fieldset.
	 * @return {HTMLFieldSetElement}
	 * @private
	 */
	getFieldsetWithFields(
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
			let wrapper, input;
			const formSpecifier = this.formSpecification.get( prefName );
			if ( formSpecifier ) {
				[ wrapper, input ] = this.getFormField( prefName, formSpecifier );
			} else {
				[ wrapper, input ] = this.getCheckbox(
					prefName,
					`codemirror-prefs-${ prefName.toLowerCase() }`,
					this.getPreference( prefName )
				);
			}
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
	 * Show the dialog with all available preferences.
	 *
	 * @param {EditorView} view
	 * @fires CodeMirror~'ext.CodeMirror.preferences.display'
	 * @return {boolean}
	 */
	showPreferencesDialog( view ) {
		if ( this.dialog ) {
			this.animateDialog( true );
			this.firePreferencesDisplayHook();
			return true;
		}

		this.view = view;

		const fieldsets = [];
		const sectionPrefs = [];
		for ( const [ section, prefs ] of Object.entries( this.dialogConfig ) ) {
			sectionPrefs.push( ...prefs );
			const fieldset = this.getFieldsetWithFields(
				prefs,
				// Message here may include but are not limited to:
				// * codemirror-prefs-section-appearance
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
				this.getFieldsetWithFields(
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
		this.dialog.querySelector( '.cdx-dialog__footer' ).prepend( this.getHelpLinks() );
		this.firePreferencesDisplayHook();

		return true;
	}

	/**
	 * @private
	 */
	firePreferencesDisplayHook() {
		/**
		 * Fired when the preferences dialog is opened.
		 *
		 * @event CodeMirror~'ext.CodeMirror.preferences.display'
		 * @param {HTMLDivElement} dialog The preferences dialog backdrop.
		 * @internal
		 */
		mw.hook( 'ext.CodeMirror.preferences.display' ).fire( this.dialog );
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

	/**
	 * @inheritDoc
	 */
	getSelect( name, label, options, selected ) {
		const [ wrapper, select ] = super.getSelect( name, label, options, selected );
		select.addEventListener( 'change', () => {
			this.extensionRegistry.reconfigureFromValueMap( name, this.view, select.value );
			this.setPreference( name, select.value );
		} );
		// Update the selected value when the preference is changed.
		mw.hook( 'ext.CodeMirror.preferences.apply' ).add( ( pref, value ) => {
			if ( pref === name ) {
				select.value = value;
			}
		} );
		return [ wrapper, select ];
	}
}

module.exports = CodeMirrorPreferences;
