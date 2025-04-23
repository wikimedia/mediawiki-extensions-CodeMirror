const {
	Compartment,
	EditorState,
	EditorView,
	Extension,
	StateEffect
} = require( 'ext.CodeMirror.v6.lib' );

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
 * @example
 * mw.loader.using( 'ext.CodeMirror.v6' ).then( ( require ) => {
 *   mw.hook( 'ext.CodeMirror.ready' ).add( ( cm ) => {
 *     const { EditorView, Prec } = require( 'ext.CodeMirror.v6.lib' );
 *     // Disable spellchecking. Use Prec.high() to override the
 *     // contentAttributesExtension which adds spellcheck="true".
 *     cm.extensionRegistry.register(
 *       'spellcheck',
 *       Prec.high( EditorView.contentAttributes.of( {
 *         spellcheck: 'false'
 *       } ) ),
 *       cm.view
 *     );
 *
 *     const toggleButton = document.querySelector( '#toggle-spellcheck' );
 *     toggleButton.addEventListener( 'click', () => {
 *       cm.extensionRegistry.toggle( 'spellcheck', cm.view );
 *     } );
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
	 * @param {boolean} [isVisualEditor=false] Whether the VE 2017 editor is being used.
	 * @hideconstructor
	 * @internal
	 */
	constructor( extensions = {}, isVisualEditor = false ) {
		/**
		 * Registry of CodeMirror Extensions, keyed by a unique string identifier.
		 *
		 * @type {Object<Extension>}
		 * @private
		 */
		this.extensions = extensions;

		/**
		 * @type {boolean}
		 * @private
		 */
		this.isVisualEditor = isVisualEditor;

		/**
		 * Registry of CodeMirror Compartments for each Extension,
		 * keyed by the same unique string identifier.
		 *
		 * @type {Object<Compartment>}
		 * @private
		 */
		this.compartments = {};

		/**
		 * Allowlist of names of CodeMirror extensions supported by the 2017 wikitext editor.
		 * Do *not* include Extensions that make changes to the document text, or visually
		 * change the placement of text.
		 *
		 * Note also that there is no UI to toggle or reconfigure CodeMirror Extensions in VE.
		 *
		 * @type {string[]}
		 */
		this.veSupportedExtensions = [
			'bracketMatching',
			'lineWrapping',
			'lineNumbering'
		];

		// Create a compartment for each extension.
		for ( const extName of this.names ) {
			// Skip if the extension is not supported by VE.
			if ( this.isVisualEditor && !this.veSupportedExtensions.includes( extName ) ) {
				delete this.extensions[ extName ];
				continue;
			}
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
	 * @param {string} name
	 * @param {Extension} extension
	 * @param {EditorView} view
	 * @param {boolean} [enable] `true` to enable the extension immediately.
	 */
	register( name, extension, view, enable ) {
		if ( !this.veSupportedExtensions.includes( name ) && this.isVisualEditor ) {
			// Unsupported.
			return;
		}
		if ( this.isRegistered( name, view ) ) {
			// Already registered, so toggle accordingly.
			if ( enable !== undefined ) {
				this.toggle( name, view, enable );
			}
			return;
		}

		this.extensions[ name ] = extension;
		this.compartments[ name ] = new Compartment();
		view.dispatch( {
			effects: StateEffect.appendConfig.of(
				this.compartments[ name ].of( enable ? extension : [] )
			)
		} );
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
	 * @param {EditorView} view
	 * @param {Extension} extension
	 */
	reconfigure( name, view, extension ) {
		if ( !this.isRegistered( name, view ) ) {
			mw.log.warn( `[CodeMirror] Extension "${ name }" is not registered.` );
			return;
		}
		view.dispatch( {
			effects: this.getCompartment( name ).reconfigure( extension )
		} );
	}

	/**
	 * Toggle on or off an extension.
	 *
	 * @param {string} name
	 * @param {EditorView} view
	 * @param {boolean} [force] `true` to enable, `false` to disable, `undefined` to toggle.
	 */
	toggle( name, view, force ) {
		if ( !this.isRegistered( name, view ) ) {
			mw.log.warn( `[CodeMirror] Extension "${ name }" is not registered.` );
			return;
		}
		const toEnable = force === undefined ? !this.isEnabled( name, view ) : force;
		this.reconfigure( name, view, toEnable ? this.extensions[ name ] : [] );
	}

	/**
	 * Check if an extension is enabled.
	 *
	 * @param {string} name
	 * @param {EditorView} view
	 * @return {boolean}
	 */
	isEnabled( name, view ) {
		if ( !this.isRegistered( name, view ) ) {
			return false;
		}
		// An Extension can be of various types (FacetProvider, PrecExtension, etc.),
		// but a "disabled" extension is always an empty array.
		const contents = this.getCompartment( name ).get( view.state );
		return !Array.isArray( contents ) || !!contents.length;
	}

	/**
	 * Check if the {@link Extension} with the given name has been appended to the
	 * {@link EditorState} configuration. In the context of CodeMirror, this means
	 * that the extension has been "registered", but not necessarily enabled.
	 *
	 * @param {string} name
	 * @param {EditorView} view
	 * @return {boolean}
	 */
	isRegistered( name, view ) {
		const compartment = this.compartments[ name ];
		return compartment && !!compartment.get( view.state );
	}
}

module.exports = CodeMirrorExtensionRegistry;
