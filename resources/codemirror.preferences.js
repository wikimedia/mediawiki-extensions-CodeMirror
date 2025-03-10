const {
	Compartment,
	EditorView,
	Extension,
	StateEffect,
	StateEffectType,
	StateField,
	keymap,
	showPanel
} = require( 'ext.CodeMirror.v6.lib' );
const CodeMirrorPanel = require( './codemirror.panel.js' );
require( './ext.CodeMirror.data.js' );

/**
 * CodeMirrorPreferences is a panel that allows users to configure CodeMirror preferences.
 * It is toggled by pressing `Ctrl`-`Shift`-`,` (or `Command`-`Shift`-`,` on macOS).
 *
 * Note that this code, like MediaWiki Core, refers to the user's preferences as "options".
 * In this class, "preferences" refer to the user's preferences for CodeMirror, which
 * are stored as a single user 'option' in the database.
 */
class CodeMirrorPreferences extends CodeMirrorPanel {
	/**
	 * @param {Object} extensionRegistry Key-value pairs of CodeMirror Extensions.
	 * @param {boolean} [isVisualEditor=false] Whether the VE 2017 editor is being used.
	 * @fires CodeMirror~'ext.CodeMirror.preferences.ready'
	 */
	constructor( extensionRegistry, isVisualEditor = false ) {
		super();

		/** @type {string} */
		this.optionName = 'codemirror-preferences';

		/** @type {boolean} */
		this.isVisualEditor = isVisualEditor;

		// VisualEditor only supports a subset of Extensions.
		const veSupportedExtensions = [
			'bracketMatching',
			'lineWrapping',
			'lineNumbering'
		];

		/**
		 * Registry of CodeMirror Extensions that are made available to CodeMirrorPreferences.
		 *
		 * @type {Object<Extension>}
		 */
		this.extensionRegistry = extensionRegistry;

		/** @type {mw.Api} */
		this.api = new mw.Api();

		/**
		 * Registry of CodeMirror Compartments that are made available for
		 * reconfiguration in CodeMirrorPreferences.
		 *
		 * @type {Object<Compartment>}
		 */
		this.compartmentRegistry = {};
		for ( const extName of Object.keys( extensionRegistry ) ) {
			if ( isVisualEditor && !veSupportedExtensions.includes( extName ) ) {
				delete this.extensionRegistry[ extName ];
				continue;
			}
			this.compartmentRegistry[ extName ] = new Compartment();
		}

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
		 * Fired just before {@link CodeMirrorPreferences} has been instantiated.
		 *
		 * @event CodeMirror~'ext.CodeMirror.preferences.ready'
		 * @param {CodeMirrorPreferences} preferences
		 */
		mw.hook( 'ext.CodeMirror.preferences.ready' ).fire( this );
	}

	/**
	 * @type {Object}
	 * @private
	 */
	get mwConfigDefaults() {
		return mw.config.get( 'extCodeMirrorConfig' ).defaultPreferences;
	}

	/**
	 * The default CodeMirror preferences, as defined by `$wgCodeMirrorPreferences`
	 * and taking into account the page namespace and content model.
	 *
	 * @return {Object}
	 */
	getDefaultPreferences() {
		if ( this.defaultPreferences ) {
			return this.defaultPreferences;
		}

		const nsId = mw.config.get( 'wgNamespaceNumber' );
		const contentModel = mw.config.get( 'wgPageContentModel' );
		const newDefaults = {};

		Object.keys( this.mwConfigDefaults ).forEach( ( prefName ) => {
			const prefValue = this.mwConfigDefaults[ prefName ] || false;

			if ( typeof prefValue === 'boolean' ) {
				newDefaults[ prefName ] = prefValue;
				return;
			}

			// Assume an array of namespace IDs (integers) and content models (strings).
			const inNamespace = prefValue.includes( nsId );
			const inContentModel = prefValue.includes( contentModel );

			newDefaults[ prefName ] = inNamespace || inContentModel;
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
				return JSON.parse( mw.user.options.get( this.optionName ) );
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
	 * @param {Mixed} value
	 */
	setPreference( key, value ) {
		this.preferences[ key ] = value;

		// Only save the preferences that differ from the defaults,
		// and use a binary representation for storage. This is to prevent
		// bloat of the user_properties table (T54777).
		let storageObj = {};
		for ( const prefName in this.preferences ) {
			if ( !!this.preferences[ prefName ] !== !!this.getDefaultPreferences()[ prefName ] || (
				// Always store preferences that have namespace or content model restrictions and
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
	 * @param {string} prefName
	 * @fires CodeMirror~'ext.CodeMirror.preferences.apply'
	 * @internal
	 */
	firePreferencesApplyHook( prefName ) {
		/**
		 * Called when a CodeMirror preference is changed or initially applied in a session.
		 *
		 * @event CodeMirror~'ext.CodeMirror.preferences.apply'
		 * @param {string} prefName
		 * @param {boolean} prefValue
		 */
		mw.hook( 'ext.CodeMirror.preferences.apply' ).fire( prefName, this.getPreference( prefName ) );
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
	 * Register an {@link Extension} with CodeMirrorPreferences, along with a
	 * corresponding {@link Compartment} so that the Extension can be reconfigured.
	 *
	 * @param {string} name
	 * @param {Extension} extension
	 * @param {EditorView} view
	 * @internal
	 */
	registerExtension( name, extension, view ) {
		this.extensionRegistry[ name ] = extension;
		this.compartmentRegistry[ name ] = new Compartment();
		view.dispatch( {
			effects: StateEffect.appendConfig.of(
				this.compartmentRegistry[ name ].of(
					this.getPreference( name ) ? this.extensionRegistry[ name ] : []
				)
			)
		} );
		this.firePreferencesApplyHook( name );
	}

	/**
	 * @inheritDoc
	 */
	get extension() {
		return [
			// Keymap for toggling the preferences panel.
			keymap.of( [
				{ key: 'Mod-Shift-,', run: ( view ) => this.toggle( view, true ) }
			] ),
			// Compartmentalized extensions
			Object.keys( this.extensionRegistry ).map( ( name ) => {
				// Only apply the extension if the preference (or default pref) is enabled.
				if ( this.getPreference( name ) ) {
					this.firePreferencesApplyHook( name );
					return this.compartmentRegistry[ name ].of( this.extensionRegistry[ name ] );
				}
				return [];
			} )
		];
	}

	/**
	 * @inheritDoc
	 */
	get panel() {
		const container = document.createElement( 'div' );
		container.className = 'cm-mw-preferences-panel cm-mw-panel';
		container.addEventListener( 'keydown', this.onKeydown.bind( this ) );

		const wrappers = [];
		for ( const prefName in this.extensionRegistry ) {
			const [ wrapper ] = this.getCheckbox(
				prefName,
				`codemirror-prefs-${ prefName.toLowerCase() }`,
				this.getPreference( prefName )
			);
			wrappers.push( wrapper );
		}
		const fieldset = this.getFieldset( mw.msg( 'codemirror-prefs-title' ), ...wrappers );
		container.appendChild( fieldset );

		const closeBtn = this.getButton( 'codemirror-close', 'close', true );
		closeBtn.classList.add( 'cdx-button--weight-quiet', 'cm-mw-panel-close' );
		container.appendChild( closeBtn );
		closeBtn.addEventListener( 'click', () => {
			this.toggle( this.view, false );
		} );

		/**
		 * Fired when the preferences panel is constructed, just before it is displayed.
		 *
		 * @event CodeMirror~'ext.CodeMirror.preferences.display'
		 * @param {HTMLDivElement} container The preferences panel container.
		 * @internal
		 * @private
		 */
		mw.hook( 'ext.CodeMirror.preferences.display' ).fire( container );

		return {
			dom: container,
			top: true
		};
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
		}

		return true;
	}

	/**
	 * Handle keydown events on the preferences panel.
	 *
	 * @param {KeyboardEvent} event
	 */
	onKeydown( event ) {
		if ( event.key === 'Escape' ) {
			event.preventDefault();
			this.toggle( this.view, false );
			this.view.focus();
		} else if ( event.key === 'Enter' ) {
			event.preventDefault();
		}
	}

	/**
	 * @inheritDoc
	 */
	getCheckbox( name, label, checked ) {
		const compartment = this.compartmentRegistry[ name ];
		const extension = this.extensionRegistry[ name ];
		const [ wrapper, input ] = super.getCheckbox( name, label, checked );
		input.addEventListener( 'change', () => {
			this.view.dispatch( {
				effects: compartment.reconfigure( input.checked ? extension : [] )
			} );
			this.setPreference( name, input.checked );

			/**
			 * Fired when a CodeMirror preference is changed.
			 * The preference may not have been saved to the database yet.
			 *
			 * @event CodeMirror~'ext.CodeMirror.preferences.change'
			 * @param {string} name The name of the preference, and the corresponding key
			 *   in the {@link CodeMirrorPreferences#extensionRegistry extensionRegistry}
			 *   and {@link CodeMirrorPreferences#compartmentRegistry compartmentRegistry}
			 *   properties.
			 * @param {boolean} value The new value of the preference.
			 */
			mw.hook( 'ext.CodeMirror.preferences.change' ).fire( name, input.checked );
		} );
		return [ wrapper, input ];
	}
}

module.exports = CodeMirrorPreferences;
