const {
	Compartment,
	EditorState,
	EditorView,
	Extension,
	StateEffect
} = require( 'ext.CodeMirror.lib' );

/**
 * Container class for housing CodeMirror {@link Extension Extensions}. Each Extension
 * is wrapped in a {@link Compartment} so that it can be
 * {@link CodeMirrorExtensionRegistry#reconfigure reconfigured}.
 *
 * If an Extension doesn't need to be reconfigured, it should instead be added during CodeMirror
 * {@link CodeMirror#initialize initialization}, or by using
 * {@link CodeMirror#applyExtension CodeMirror#applyExtension()}.
 *
 * The constructor is internal. The class can be accessed via {@link CodeMirror#extensionRegistry}.
 *
 * Methods that read or change the configuration take an {@link Editor}, so integrations
 * that have no {@link EditorView} can pass themselves instead.
 *
 * @example
 * const require = await mw.loader.using( 'ext.CodeMirror' );
 * mw.hook( 'ext.CodeMirror.ready' ).add( ( cm ) => {
 *   const { EditorView, Prec } = require( 'ext.CodeMirror.lib' );
 *   // Disable spellchecking. Use Prec.high() to override the
 *   // contentAttributesExtension which adds spellcheck="true".
 *   cm.extensionRegistry.register(
 *     'spellcheck',
 *     Prec.high( EditorView.contentAttributes.of( {
 *       spellcheck: 'false'
 *     } ) ),
 *     cm.view
 *   );
 *
 *   const toggleButton = document.querySelector( '#toggle-spellcheck' );
 *   toggleButton.addEventListener( 'click', () => {
 *     cm.extensionRegistry.toggle( 'spellcheck', cm.view );
 *   } );
 * } );
 */
class CodeMirrorExtensionRegistry {
	/**
	 * For use only by the {@link CodeMirror} class constructor.
	 *
	 * @param {Object<Extension>} extensions Keyed by a unique string identifier.
	 *   These extensions will be included in the configuration during CodeMirror
	 *   initialization via {@link CodeMirrorPreferences}.
	 * @param {string[]|null} [supportedExtensions] Names that
	 *   {@link CodeMirrorExtensionRegistry#register register()} will accept, or `null` to
	 *   accept any name. Comes from {@link CodeMirror#supportedExtensions}.
	 * @hideconstructor
	 * @internal
	 */
	constructor( extensions = {}, supportedExtensions = null ) {
		/**
		 * Registry of CodeMirror Extensions, keyed by a unique string identifier.
		 *
		 * @type {Object<Extension>}
		 * @private
		 */
		this.extensions = extensions;

		/**
		 * Names that {@link CodeMirrorExtensionRegistry#register register()} will accept,
		 * or `null` to accept any name.
		 *
		 * @type {string[]|null}
		 * @private
		 */
		this.supportedExtensions = supportedExtensions;

		/**
		 * Registry of CodeMirror Compartments for each Extension,
		 * keyed by the same unique string identifier.
		 *
		 * @type {Object<Compartment>}
		 * @private
		 */
		this.compartments = {};

		/**
		 * Map of reconfiguration values and the {@link Extension extensions} that should be
		 * applied when a compartmentalized extension is reconfigured with that value.
		 *
		 * Keyed by extension name, then by 'reconfig value' and then the implementing Extension.
		 *
		 * This is used when we need to pass around the CodeMirrorExtensionRegistry but keep
		 * track of the Extension values elsewhere.
		 *
		 * @see CodeMirrorExtensionRegistry#reconfigure
		 * @type {Map<string, Map>}
		 * @internal
		 */
		this.reconfigValueMap = new Map();

		// Create a compartment for each extension.
		for ( const extName of this.names ) {
			// The compartmentalized extensions here are included during
			// CodeMirror initialization via CodeMirrorPreferences#extension.
			this.compartments[ extName ] = new Compartment();
		}
	}

	/**
	 * Get the compartmentalized {@link Extension} with the given name.
	 *
	 * This should only be used when including registered extensions during
	 * CodeMirror initialization such as with {@link CodeMirrorPreferences#extension}.
	 *
	 * @param {string} name
	 * @return {Extension|undefined}
	 * @internal
	 */
	get( name ) {
		if ( !this.compartments[ name ] ) {
			return undefined;
		}
		return this.compartments[ name ].of( this.extensions[ name ] );
	}

	/**
	 * Get the `Compartment` for the extension with the given name.
	 *
	 * @param {string} name
	 * @return {Compartment|undefined}
	 */
	getCompartment( name ) {
		return this.compartments[ name ];
	}

	/**
	 * The names of all registered Extensions.
	 *
	 * @type {string[]}
	 */
	get names() {
		return Object.keys( this.extensions );
	}

	/**
	 * Register an {@link Extension}, creating a corresponding {@link Compartment}.
	 * The Extension can then be {@link CodeMirrorExtensionRegistry#reconfigure reconfigured}
	 * such as {@link CodeMirrorExtensionRegistry#toggle toggling} on and off.
	 *
	 * Integrations that can only support some extensions declare which through
	 * {@link CodeMirror#supportedExtensions}, and anything else is refused here.
	 *
	 * @param {string} name
	 * @param {Extension} extension
	 * @param {Editor} editor
	 * @param {boolean} [enable] `true` to enable the extension immediately.
	 */
	register( name, extension, editor, enable ) {
		if ( this.supportedExtensions && !this.supportedExtensions.includes( name ) ) {
			mw.log.warn( `[CodeMirror] Extension "${ name }" is not supported by this editor.` );
			return;
		}

		if ( this.isRegistered( name, editor ) ) {
			// Already registered, so toggle accordingly.
			if ( enable !== undefined ) {
				this.toggle( name, editor, enable );
			}
			return;
		}

		this.extensions[ name ] = extension;
		this.compartments[ name ] = new Compartment();
		editor.dispatch( {
			effects: StateEffect.appendConfig.of(
				this.compartments[ name ].of( enable ? extension : [] )
			)
		} );
	}

	/**
	 * Register an extension with an initial value from the
	 * {@link #reconfigValueMap reconfiguration value map}.
	 *
	 * @param {string} name
	 * @param {Editor} editor
	 * @param {string} reconfigValue
	 * @internal
	 */
	registerFromValueMap( name, editor, reconfigValue ) {
		this.register( name, this.reconfigValueMap.get( name ).get( reconfigValue ), editor, true );
	}

	/**
	 * Reconfigure a compartmentalized extension with a new {@link Extension}.
	 *
	 * @example
	 * const cm = new CodeMirror( ... );
	 * // Register an Extension that sets the tab size to 5 spaces.
	 * cm.extensionRegistry.register( 'tabSize', EditorState.tabSize.of( 5 ), cm.view, true );
	 * // Reconfigure the tab size to 10 spaces.
	 * cm.extensionRegistry.reconfigure( 'tabSize', cm.view, EditorState.tabSize.of( 10 ) );
	 *
	 * @param {string} name
	 * @param {Editor} editor
	 * @param {Extension} extension
	 */
	reconfigure( name, editor, extension ) {
		if ( !this.isRegistered( name, editor ) ) {
			mw.log.warn( `[CodeMirror] Extension "${ name }" is not registered.` );
			return;
		}
		editor.dispatch( {
			effects: this.getCompartment( name ).reconfigure( extension )
		} );
	}

	/**
	 * Reconfigure a compartmentalized extension with a value from the
	 * {@link #reconfigValueMap reconfiguration value map}.
	 *
	 * @param {string} name
	 * @param {Editor} editor
	 * @param {string} reconfigValue
	 * @internal
	 */
	reconfigureFromValueMap( name, editor, reconfigValue ) {
		this.reconfigure( name, editor, this.reconfigValueMap.get( name ).get( reconfigValue ) );
	}

	/**
	 * Toggle on or off an extension.
	 *
	 * @param {string} name
	 * @param {Editor} editor
	 * @param {PrefValue} [force] `true` to enable, `false` to disable, `undefined` to toggle,
	 *   or a string value to force-enable with the given value from the
	 *   {@link #reconfigValueMap reconfiguration value map}.
	 */
	toggle( name, editor, force ) {
		if ( !this.isRegistered( name, editor ) ) {
			mw.log.warn( `[CodeMirror] Extension "${ name }" is not registered.` );
			return;
		}
		if ( typeof force === 'string' ) {
			this.reconfigureFromValueMap( name, editor, force );
		} else {
			const toEnable = force === undefined ? !this.isEnabled( name, editor ) : force;
			this.reconfigure( name, editor, toEnable ? this.extensions[ name ] : [] );
		}
	}

	/**
	 * Check if an extension is enabled.
	 *
	 * @param {string} name
	 * @param {Editor} editor
	 * @return {boolean}
	 */
	isEnabled( name, editor ) {
		if ( !this.isRegistered( name, editor ) ) {
			return false;
		}
		// An Extension can be of various types (FacetProvider, PrecExtension, etc.),
		// but a "disabled" extension is always an empty array.
		const contents = this.getCompartment( name ).get( editor.state );
		return !Array.isArray( contents ) || !!contents.length;
	}

	/**
	 * Check if the {@link Extension} with the given name has been appended to the
	 * {@link EditorState} configuration. In the context of CodeMirror, this means
	 * that the extension has been "registered", but not necessarily enabled.
	 *
	 * @param {string} name
	 * @param {Editor} editor
	 * @return {boolean}
	 */
	isRegistered( name, editor ) {
		const compartment = this.compartments[ name ];
		return compartment && !!compartment.get( editor.state );
	}
}

module.exports = CodeMirrorExtensionRegistry;
