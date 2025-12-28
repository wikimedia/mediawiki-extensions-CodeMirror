const {
	acceptCompletion,
	defaultKeymap,
	keymap,
	redo,
	redoSelection,
	startCompletion,
	undo,
	undoSelection,
	EditorView,
	Extension,
	KeyBinding,
	Prec,
	StateEffect
} = require( 'ext.CodeMirror.v6.lib' );
const CodeMirrorCodex = require( './codemirror.codex.js' );

/**
 * Key bindings for CodeMirror.
 *
 * This class provides key bindings for CodeMirror, including a help dialog
 * that lists the available shortcuts, accessible via `Ctrl`-`Shift`-`/`.
 *
 * Additional {@link CodeMirrorKeyBinding key bindings} can be registered using
 * {@link CodeMirrorKeymap#registerKeyBinding registerKeyBinding()}. This will
 * take effect in the editor immediately.
 *
 * To document key bindings in the help dialog, use
 * {@link CodeMirrorKeymap#registerKeyBindingHelp registerKeyBindingHelp()}, which
 * can optionally also enable the key binding in the editor.
 *
 * Both methods require an {@link EditorView}, which is only accessible after
 * CodeMirror has been initialized. For dynamically added key bindings, use the
 * {@link event:'ext.CodeMirror.ready' ext.CodeMirror.ready} hook to have access to
 * the {@link CodeMirror} instance after initialization, which will have the
 * {@link CodeMirror#view CodeMirror.view} property set.
 *
 * @example
 * mw.hook( 'ext.CodeMirror.ready' ).add( ( cm ) => {
 *   const myKeybinding = {
 *     key: 'F1',
 *     run: () => {
 *       // Do something when F1 is pressed.
 *     }
 *   };
 *
 *   // Register the key binding in the editor.
 *   cm.keymap.registerKeyBinding( myKeybinding, cm.view );
 *
 *   // Or, register only in the help dialog.
 *   cm.keymap.registerKeyBindingHelp( 'other', 'myKeybinding', myKeybinding );
 *
 *   // Or, both.
 *   cm.keymap.registerKeyBindingHelp( 'other', 'myKeybinding', myKeybinding, cm.view );
 * } );
 */
class CodeMirrorKeymap extends CodeMirrorCodex {

	constructor() {
		super();

		/** @type {Function} */
		this.keydownListener = null;

		/**
		 * Platform name, used for platform-specific key bindings.
		 * This uses the same platform-detection logic as CodeMirror.
		 * One of `mac`, `win`, `linux`, or a blank string.
		 *
		 * @type {string}
		 */
		this.platform = '';
		const nav = typeof navigator !== 'undefined' ?
			navigator :
			{ platform: '', vendor: '', userAgent: '', maxTouchPoints: 0 };
		if ( nav.platform.match( /Mac/ ) || (
			/Apple Computer/.test( nav.vendor ) && (
				/Mobile\/\w+/.test( nav.userAgent ) || nav.maxTouchPoints > 2
			)
		) ) {
			this.platform = 'mac';
		} else if ( nav.platform.match( /Win/ ) ) {
			this.platform = 'win';
		} else if ( nav.platform.match( /Linux|X11/ ) ) {
			this.platform = 'linux';
		}

		/**
		 * {@link CodeMirrorPreferences} instance, once available.
		 * Used to dynamically show/hide key bindings based on user preferences.
		 *
		 * @type {CodeMirrorPreferences|null}
		 * @private
		 */
		this.preferences = null;
		mw.hook( 'ext.CodeMirror.preferences.ready' ).add( ( preferences ) => {
			this.preferences = preferences;
		} );

		/**
		 * Registry of key bindings we want to advertise in the help dialog.
		 * The outer keys are the section within the dialog. The objects therein are for
		 * each mapping (command) we want to show, keyed by tool. The value for each is
		 * a {@link CodeMirrorKeyBinding} object, or an array of them.
		 *
		 * @type {Object<Object<CodeMirrorKeyBinding>>|Object<Object<CodeMirrorKeyBinding[]>>}
		 * @property {Object<CodeMirrorKeyBinding>|Object<CodeMirrorKeyBinding[]>} textStyling
		 * @property {Object<CodeMirrorKeyBinding>|Object<CodeMirrorKeyBinding[]>} history
		 * @property {Object<CodeMirrorKeyBinding>|Object<CodeMirrorKeyBinding[]>} paragraph
		 * @property {Object<CodeMirrorKeyBinding>|Object<CodeMirrorKeyBinding[]>} search
		 * @property {Object<CodeMirrorKeyBinding>|Object<CodeMirrorKeyBinding[]>} insert
		 * @property {Object<CodeMirrorKeyBinding>|Object<CodeMirrorKeyBinding[]>} other
		 */
		this.keymapHelpRegistry = {
			// Empty values are placeholders for MW-specific key bindings
			// so that they appear in the correct order in the help dialog.
			textStyling: {},
			accessibility: {},
			// Use our own history keymap since it differs greatly from stock CodeMirror.
			history: {
				undo: {
					key: 'Mod-z',
					run: undo,
					preventDefault: true
				},
				redo: [
					{
						key: 'Mod-y',
						mac: 'Mod-Shift-z',
						run: redo,
						preventDefault: true
					}, {
						linux: 'Ctrl-Shift-z',
						// T365072
						win: 'Ctrl-Shift-z',
						run: redo,
						preventDefault: true
					}
				],
				// TODO: Find something that works for Mac.
				undoSelection: {
					win: 'Meta-u',
					linux: 'Meta-u',
					run: undoSelection,
					preventDefault: true
				},
				redoSelection: {
					win: 'Meta-Shift-u',
					linux: 'Meta-Shift-u',
					run: redoSelection,
					preventDefault: true
				}
			},
			paragraph: {
				indent: { key: 'Mod-]' },
				outdent: { key: 'Mod-[' }
			},
			search: {
				find: { key: 'Mod-f' },
				findNext: {
					key: 'Mod-g',
					msg: mw.msg( 'codemirror-next' ),
					aliases: [ 'F3' ]
				},
				findPrev: { key: 'Shift-Mod-g', msg: mw.msg( 'codemirror-previous' ) },
				selectNext: { key: 'Mod-d' },
				gotoLine: { key: 'Mod-Alt-g', msg: mw.msg( 'codemirror-goto-line' ) }
			},
			insert: {
				blankLine: { key: 'Mod-Enter' }
			},
			codeFolding: {
				fold: {
					key: 'Ctrl-Shift-[',
					mac: 'Cmd-Alt-['
				},
				unfold: {
					key: 'Ctrl-Shift-]',
					mac: 'Cmd-Alt-]'
				},
				foldAll: { key: 'Ctrl-Alt-[' },
				unfoldAll: { key: 'Ctrl-Alt-]' }
			},
			autocomplete: [
				{
					key: 'Shift-Enter',
					aliases: [ 'Ctrl-Space' ],
					run: startCompletion,
					prec: Prec.high,
					msg: mw.msg( 'codemirror-keymap-startcompletion' )
				},
				{
					key: 'Tab',
					aliases: [ 'Enter' ],
					run: acceptCompletion,
					msg: mw.msg( 'codemirror-keymap-selectcompletion' )
				}
			],
			lint: {},
			other: {
				moveLine: {
					key: 'Alt-↑/↓',
					msg: mw.msg( 'codemirror-keymap-moveline' )
				},
				copyLine: {
					key: 'Alt-Shift-↑/↓',
					msg: mw.msg( 'codemirror-keymap-copyline' )
				},
				direction: { key: 'Mod-Shift-x' },
				preferences: {
					key: 'Mod-Shift-,',
					msg: mw.msg( 'codemirror-keymap-preferences' )
				},
				fullPreferences: {
					key: 'Alt-Shift-,',
					msg: mw.msg( 'codemirror-keymap-full-preferences' )
				},
				help: {
					key: 'Ctrl-Shift-/',
					run: this.showHelpDialog.bind( this ),
					preventDefault: true
				}
			}
		};

		/**
		 * Map of descriptions of cursor modifiers (e.g. multi-cursor, crosshair).
		 * (Un)set elements directly on this map to document new cursor modifiers.
		 *
		 * Keys are unique names, values are the descriptions.
		 *
		 * @type {Map<string, string>}
		 */
		this.cursorModifiers = new Map( [
			[ 'multiCursor', mw.msg( 'codemirror-keymap-multicursor', this.getShortcutHtml( 'Mod' ).outerHTML ) ],
			[ 'crosshair', mw.msg( 'codemirror-keymap-crosshair', this.getShortcutHtml( 'Alt' ).outerHTML ) ]
		] );

		// Use mw.hook to add a click listener to the keymap help button.
		mw.hook( 'ext.CodeMirror.preferences.display' ).add( ( container ) => {
			container.querySelector( '.cm-mw-panel--kbd-help' ).addEventListener( 'click',
				() => this.showHelpDialog()
			);
		} );
	}

	/**
	 * Show the keymap help dialog.
	 *
	 * @return {boolean}
	 */
	showHelpDialog() {
		/**
		 * Fired when the keymap help dialog is opened.
		 *
		 * @event CodeMirror~ext.CodeMirror.keymap
		 * @internal
		 */
		mw.hook( 'ext.CodeMirror.keymap' ).fire();

		this.showDialog( 'codemirror-keymap-help-title', 'keymap', this.getHelpDialogBody() );
		return true;
	}

	/**
	 * @return {HTMLElement[]}
	 * @private
	 */
	getHelpDialogBody() {
		const keybindingsContainer = document.createElement( 'section' );
		keybindingsContainer.classList.add( 'cm-mw-keymap-dialog__keybindings', 'cm-mw-dialog--columns' );
		const sections = Object.keys( this.keymapHelpRegistry );
		// Count of non-empty sections.
		let sectionCount = 0;
		for ( const section of sections ) {
			const commands = Object.keys( this.keymapHelpRegistry[ section ] );
			if ( !commands.length ) {
				continue;
			}
			sectionCount++;
			const sectionEl = document.createElement( 'div' );
			// CSS class names known to be used here include but are not limited to:
			// * cm-mw-keymap-section--autocomplete
			// * cm-mw-keymap-section--codefolding
			// * cm-mw-keymap-section--history
			// * cm-mw-keymap-section--insert
			// * cm-mw-keymap-section--other
			// * cm-mw-keymap-section--paragraph
			// * cm-mw-keymap-section--search
			// * cm-mw-keymap-section--textstyling
			sectionEl.className = `cm-mw-keymap-section cm-mw-keymap-section--${ section.toLowerCase() }`;
			this.setDisplayFromPreference( section, sectionEl );

			const heading = document.createElement( 'h4' );
			// Messages known to be used here include but are not limited to:
			// * codemirror-keymap-autocomplete
			// * codemirror-keymap-codefolding
			// * codemirror-keymap-history
			// * codemirror-keymap-insert
			// * codemirror-keymap-other
			// * codemirror-keymap-paragraph
			// * codemirror-keymap-search
			// * codemirror-keymap-textstyling
			heading.textContent = mw.msg( `codemirror-keymap-${ section.toLowerCase() }` );
			const dl = document.createElement( 'dl' );
			dl.classList.add( 'cm-mw-keymap-list' );
			for ( const command of commands ) {
				const keyBinding = this.reduceKeyBindings(
					this.keymapHelpRegistry[ section ][ command ]
				);

				// Skip if the binding has a null `msg` or if it doesn't apply to this platform.
				if ( keyBinding.msg === null ||
					( !keyBinding[ this.platform ] && !keyBinding.key )
				) {
					continue;
				}

				// Create <dt> element containing the key binding(s).
				const dt = document.createElement( 'dt' );
				const keys = [
					keyBinding[ this.platform ] || keyBinding.key,
					...( keyBinding.aliases || [] )
				];
				for ( const key of keys ) {
					dt.appendChild( this.getShortcutHtml( key ) );
				}
				dl.appendChild( dt );

				// Create <dd> element containing the command name/description.
				const dd = document.createElement( 'dd' );
				// Set the message for the CodeMirrorKeyBinding. If the 'msg' property
				// is set, use that, otherwise use the key 'codemirror-keymap-<command>'.
				dd.textContent = keyBinding.msg ||
					// Messages known to be used here include but are not limited to:
					// * codemirror-keymap-blockquote
					// * codemirror-keymap-bold
					// * codemirror-keymap-comment
					// * codemirror-keymap-computercode
					// * codemirror-keymap-find
					// * codemirror-keymap-findnext
					// * codemirror-keymap-findprev
					// * codemirror-keymap-gotoline
					// * codemirror-keymap-heading
					// * codemirror-keymap-indent
					// * codemirror-keymap-italic
					// * codemirror-keymap-link
					// * codemirror-keymap-outdent
					// * codemirror-keymap-preformatted
					// * codemirror-keymap-redo
					// * codemirror-keymap-redoselection
					// * codemirror-keymap-reference
					// * codemirror-keymap-selectnext
					// * codemirror-keymap-strikethrough
					// * codemirror-keymap-subscript
					// * codemirror-keymap-superscript
					// * codemirror-keymap-underline
					// * codemirror-keymap-undo
					// * codemirror-keymap-undoselection
					mw.msg( `codemirror-keymap-${ command.toLowerCase() }` );
				if ( keyBinding.slow ) {
					const slowSpan = document.createElement( 'span' );
					slowSpan.classList.add( 'cm-mw-slow-feature' );
					slowSpan.textContent = mw.msg( 'parentheses', mw.msg( 'codemirror-potentially-slow' ) );
					dd.append( ' ' );
					dd.appendChild( slowSpan );
				}
				dl.appendChild( dd );

				this.setDisplayFromPreference( command, dt );
				this.setDisplayFromPreference( command, dd );
			}
			sectionEl.appendChild( heading );
			sectionEl.appendChild( dl );
			keybindingsContainer.appendChild( sectionEl );
		}

		// If there are no four or fewer sections, show only two columns.
		// This happens if the LanguageSupport extension did not
		// register any additional key bindings, throwing off the styling.
		if ( sectionCount <= 4 ) {
			keybindingsContainer.classList.add( 'cm-mw-dialog__columns--two-col' );
		}

		// Cursor modifiers.
		const cursorSection = document.createElement( 'section' );
		cursorSection.classList.add( 'cm-mw-keymap-dialog__cursor' );
		const h4 = document.createElement( 'h4' );
		h4.textContent = mw.msg( 'codemirror-keymap-cursor-modifiers' );
		cursorSection.appendChild( h4 );

		const ul = document.createElement( 'ul' );
		for ( const [ cursorModName, description ] of this.cursorModifiers ) {
			const li = document.createElement( 'li' );
			li.innerHTML = description;
			ul.appendChild( li );
			this.setDisplayFromPreference( cursorModName, li );
		}
		cursorSection.appendChild( ul );

		return [ keybindingsContainer, cursorSection ];
	}

	/**
	 * Reduce the given key bindings into a single CodeMirrorKeyBinding,
	 * with additional applicable keys under the aliases property.
	 *
	 * @param {CodeMirrorKeyBinding|CodeMirrorKeyBinding[]} given
	 * @return {CodeMirrorKeyBinding}
	 * @private
	 */
	reduceKeyBindings( given ) {
		/** @type {CodeMirrorKeyBinding[]} */
		const keyBindings = [].concat.apply( [], new Array( given ) );
		return keyBindings.reduce( ( acc, kb ) => {
			const relevantKey = kb[ this.platform ] || kb.key;
			if ( !acc ) {
				acc = kb;
			} else if ( relevantKey ) {
				acc.aliases = [ ...acc.aliases || [], relevantKey ];
			}
			return acc;
		} );
	}

	/**
	 * Set the display of an HTMLElement based on a preference. This uses the
	 * `ext.CodeMirror.preferences.apply` hook to update the display when the preference changes.
	 *
	 * @param {string} prefName
	 * @param {HTMLElement} el
	 * @internal
	 * @private
	 */
	setDisplayFromPreference( prefName, el ) {
		if ( !this.preferences ) {
			// Can happen in Jest tests.
			return;
		}
		// We don't have an EditorView, so directly check against the extension registry.
		const isRegistered = !!this.preferences.extensionRegistry.compartments[ prefName ];
		const shouldDisplay = !isRegistered || this.preferences.getPreference( prefName );
		el.style.display = shouldDisplay ? '' : 'none';

		if ( shouldDisplay ) {
			mw.hook( 'ext.CodeMirror.preferences.apply' ).add( ( pref, enabled ) => {
				if ( pref === prefName ) {
					el.style.display = enabled ? '' : 'none';
				}
			} );
		}
	}

	/**
	 * Get the `<kbd>` HTML for a key binding sequence.
	 * This takes into account platform-specific key names.
	 *
	 * @param {string} keyBindingSequence
	 * @return {HTMLElement}
	 * @internal
	 */
	getShortcutHtml( keyBindingSequence ) {
		const outerKbd = document.createElement( 'kbd' );
		outerKbd.classList.add( 'cm-mw-keymap-key' );
		const keys = keyBindingSequence.split( '-' )
			.map( ( key ) => {
				// Normalize capitalized keys to include Shift in the help dialog.
				if ( key.length === 1 && key !== key.toLowerCase() ) {
					return `Shift-${ key.toLowerCase() }`;
				}
				return key;
			} )
			.join( '-' )
			.split( '-' );
		// Build the <kbd> elements.
		keys.forEach( ( key, index ) => {
			// Normalize Cmd to ⌘ Cmd on macOS, and Ctrl on other platforms.
			if ( key.toLowerCase() === 'mod' ) {
				key = this.platform === 'mac' ? '⌘ Cmd' : 'Ctrl';
			} else if ( key.toLowerCase() === 'cmd' ) {
				key = '⌘ Cmd';
			} else if ( key.toLowerCase() === 'alt' && this.platform === 'mac' ) {
				key = '⌥ Option';
			} else if ( key === 'ArrowUp' ) {
				key = '↑';
			} else if ( key === 'ArrowDown' ) {
				key = '↓';
			}
			const kbd = document.createElement( 'kbd' );
			kbd.textContent = key;
			outerKbd.appendChild( kbd );
			if ( index < keys.length - 1 ) {
				const plus = document.createTextNode( '+' );
				outerKbd.appendChild( plus );
			}
		} );
		return outerKbd;
	}

	/**
	 * @typedef {Object} CodeMirrorKeymap~CodeMirrorKeyBinding
	 * @extends KeyBinding
	 * @description Extends CodeMirror's {@link KeyBinding} interface with additional properties.
	 * @see https://codemirror.net/docs/ref/#view.KeyBinding
	 * @property {string} [key] The key binding sequence, i.e. `Mod-Shift-/`. Any applicable
	 *   platform-specific key bindings will take precedence over this.
	 * @property {string} [mac] The key binding sequence to use specifically on macOS.
	 * @property {string} [win] The key binding sequence to use specifically on Windows
	 * @property {string} [linux] The key binding sequence to use specifically on Linux.
	 * @property {string[]} [aliases] Additional key binding sequences that trigger the command.
	 * @property {Command} [run] The function to run when the key binding is triggered.
	 * @property {boolean} [preventDefault=false] Prevent the default behavior of the key binding.
	 * @property {string|null} [msg] Override the auto-generated message in the help dialog.
	 *   If not provided, a message key will be generated of the form `codemirror-keymap-<command>`
	 *   and rendered with {@link mw.msg}. Use `null` to exclude the command from the help dialog.
	 * @property {boolean} [slow=false] Whether the command is potentially slow and should be
	 *   indicated as such in the help dialog.
	 * @property {Function} [prec={@link Prec.default}] The precedence function to use for the key
	 *   binding. See {@link Prec} for details.
	 */

	/**
	 * Register a key binding in the help dialog. If a `view` is passed in and the key binding
	 * has a `run` function, the key binding will also be enabled in the editor.
	 * If no `run` function exists, a key binding will only be documented in
	 * the help dialog and is presumed to be implemented elsewhere.
	 *
	 * If the `section` or `tool` matches the name of an `Extension` registered with
	 * {@link CodeMirrorPreferences}, a help entry is only shown when the preference is enabled.
	 *
	 * @param {string} section The section in the help dialog where the binding should be listed.
	 * @param {string} tool Transformed into a message key like `'codemirror-keymap-<tool>'`.
	 * @param {CodeMirrorKeyBinding|null} [keyBinding=null]
	 *   `null` if this is a documentation-only.
	 * @param {EditorView} [view=null]
	 *   If provided, the key binding will be enabled as an Extension in the editor.
	 */
	registerKeyBindingHelp( section, tool, keyBinding = null, view = null ) {
		this.keymapHelpRegistry[ section ] = this.keymapHelpRegistry[ section ] || {};
		this.keymapHelpRegistry[ section ][ tool ] = keyBinding;
		if ( keyBinding.run && view ) {
			this.registerKeyBinding( keyBinding, view );
		}
	}

	/**
	 * Register a key binding with CodeMirror.
	 *
	 * @param {CodeMirrorKeyBinding} keyBinding The key binding to register.
	 * @param {EditorView} view The `EditorView` to register the key binding(s) with.
	 * @stable
	 */
	registerKeyBinding( keyBinding, view ) {
		const precFn = keyBinding.prec || Prec.default;
		const extension = precFn( keymap.of( keyBinding ) );
		view.dispatch( {
			effects: StateEffect.appendConfig.of( extension )
		} );
	}

	/**
	 * For use only during CodeMirror initialization.
	 *
	 * @type {Extension[]}
	 * @internal
	 */
	get extension() {
		const extensions = [
			// Default keymap.
			keymap.of( defaultKeymap )
		];

		// Add Commands (key bindings with `run`) defined in this.keymapHelpRegistry.
		for ( const section in this.keymapHelpRegistry ) {
			for ( const command in this.keymapHelpRegistry[ section ] ) {
				/** @type {CodeMirrorKeyBinding[]} */
				const keyBindings = [].concat.apply( [],
					new Array( this.keymapHelpRegistry[ section ][ command ] )
				);
				for ( const keyBinding of keyBindings ) {
					if ( keyBinding.run ) {
						const precFn = keyBinding.prec || Prec.default;
						extensions.push( precFn( keymap.of( keyBinding ) ) );
					}
				}
			}
		}

		return extensions;
	}
}

module.exports = CodeMirrorKeymap;
