const { Extension, Prec } = require( 'ext.CodeMirror.v6.lib' );
const CodeMirror = require( 'ext.CodeMirror.v6' );

/**
 * A `CodeMirrorChild` is a CodeMirror instance controlled by a 'primary'
 * {@link CodeMirror} instance.
 *
 * This will sync preference changes from the primary instance and add hook
 * handlers to toggle the child instance when the primary instance is toggled.
 *
 * @example
 * const cm = new CodeMirror( textarea, languageExtension );
 * const cmChild = new cm.child( otherTextarea, cm, languageExtension );
 * cm.initialize();
 * // Will apply to both instances.
 * cm.toggle();
 * @class
 * @extends CodeMirror
 */
class CodeMirrorChild extends CodeMirror {
	/**
	 * Instantiate a child CodeMirror instance given a primary instance.
	 *
	 * @param {HTMLTextAreaElement} textarea Child textarea element.
	 * @param {CodeMirror} primaryInstance The primary CodeMirror instance to sync with.
	 * @param {LanguageSupport|Extension} [langExtension] Language support and its extension(s).
	 *   If not provided, the primary instance's language support will be used.
	 * @override
	 */
	constructor( textarea, primaryInstance, langExtension ) {
		super( textarea, langExtension || primaryInstance.langExtension );

		/**
		 * The primary CodeMirror instance.
		 *
		 * @type {CodeMirror}
		 */
		this.primaryInstance = primaryInstance;
	}

	/**
	 * @inheritDoc
	 */
	initialize( extensions = this.defaultExtensions ) {
		super.initialize( extensions );

		// Register the preferences keymap for this instance to route to the primary instance.
		this.keymap.registerKeyBinding(
			Object.assign( {}, this.keymap.keymapHelpRegistry.other.preferences, {
				prec: Prec.highest,
				run: () => {
					this.primaryInstance.preferences.toggle( this.primaryInstance.view, true );
					return true;
				}
			} ),
			this.view
		);

		// Toggle this CodeMirror instance when the primary instance is toggled.
		mw.hook( 'ext.CodeMirror.toggle' ).add( ( enabled, _cm, textarea ) => {
			if ( textarea !== this.textarea && enabled !== this.isActive ) {
				this.toggle( enabled );
			}
		} );

		// Sync preferences between this instance and the primary instance.
		mw.hook( 'ext.CodeMirror.preferences.apply' ).add( ( prefName, enabled ) => {
			if ( enabled !== this.preferences.getPreference( prefName ) ) {
				this.extensionRegistry.toggle( prefName, this.view, enabled );
				this.preferences.setPreference( prefName, enabled );
			}
		} );
	}

	// Don't log activation or feature usage for child instances.

	/**
	 * @override
	 */
	// eslint-disable-next-line no-unused-vars
	logEditFeature( action ) {}

	/**
	 * @override
	 */
	setupFeatureLogging() {}
}

module.exports = CodeMirrorChild;
