const { EditorView, Prec } = require( 'ext.CodeMirror.v6.lib' );

/**
 * MediaWiki-specific key bindings for CodeMirror.
 * This is automatically applied when using {@link CodeMirrorModeMediaWiki}.
 *
 * @module CodeMirrorMediaWikiKeymap
 */
class CodeMirrorMediaWikiKeymap {

	/**
	 * Must be constructed *after* the
	 * {@link event:'ext.CodeMirror.ready' ext.CodeMirror.ready} event.
	 *
	 * @param {CodeMirror} cm
	 */
	constructor( cm ) {
		/** @type {CodeMirror} */
		this.cm = cm;

		/** @type {CodeMirrorKeymap} */
		this.keymap = cm.keymap;

		/** @type {CodeMirrorPreferences} */
		this.preferences = cm.preferences;

		/** @type {Object} */
		this.wikiEditor = cm.$textarea.data( 'wikiEditorContext' );

		/** @type {EditorView} */
		this.view = cm.view;

		/** @type {Object<Object<CodeMirrorKeyBinding>>} */
		this.mwKeymapRegistry = {
			textStyling: {
				bold: {
					key: 'Mod-b',
					run: this.bold.bind( this )
				},
				italic: {
					key: 'Mod-i',
					run: this.italic.bind( this ),
					// Overrides CM native selectParentSyntax command.
					prec: Prec.highest
				},
				link: {
					key: 'Mod-k',
					run: this.link.bind( this )
				},
				computerCode: {
					key: 'Mod-Shift-6',
					run: this.computerCode.bind( this )
				},
				strikethrough: {
					key: 'Ctrl-Shift-5',
					run: this.strikethrough.bind( this ),
					preventDefault: true
				},
				subscript: {
					key: `${ $.client.profile().name === 'safari' ? 'Ctrl' : 'Mod' }-,`,
					run: this.subscript.bind( this )
				},
				superscript: {
					key: 'Mod-.',
					// Ctrl-. is the new emoji selector on Ubuntu, so we provide an alternative.
					linux: 'Ctrl-Shift-.',
					run: this.superscript.bind( this )
				},
				underline: {
					key: 'Mod-u',
					run: this.underline.bind( this )
				},
				nowiki: {
					key: 'Mod-\\',
					run: this.nowiki.bind( this )
				}
			},
			paragraph: {
				preformatted: {
					key: 'Ctrl-7',
					run: this.preformatted.bind( this ),
					preventDefault: true
				},
				blockquote: {
					key: 'Ctrl-8',
					run: this.blockquote.bind( this )
				},
				// Headings 1-6 are documented as a single line in the help dialog.
				// This 'heading' keymap is solely for documentation purposes.
				heading: {
					// The '1-6' uses a minus sign (−) instead of a hyphen (-)
					// so that the 1 and 6 aren't read as separated keys.
					key: 'Ctrl-1−6',
					msg: mw.msg( 'codemirror-keymap-heading' )
				},
				// The actual keymaps have `msg: null` to hide them from the help dialog.
				heading1: {
					key: 'Ctrl-1',
					run: this.heading.bind( this, 1 ),
					msg: null
				},
				heading2: {
					key: 'Ctrl-2',
					run: this.heading.bind( this, 2 ),
					msg: null
				},
				heading3: {
					key: 'Ctrl-3',
					run: this.heading.bind( this, 3 ),
					msg: null
				},
				heading4: {
					key: 'Ctrl-4',
					run: this.heading.bind( this, 4 ),
					msg: null
				},
				heading5: {
					key: 'Ctrl-5',
					run: this.heading.bind( this, 5 ),
					msg: null
				},
				heading6: {
					key: 'Ctrl-6',
					run: this.heading.bind( this, 6 ),
					msg: null
				}
			},
			insert: {
				reference: {},
				comment: {
					key: 'Mod-/',
					run: this.comment.bind( this )
				}
			}
		};

		// Only add 'reference' if Extension:Cite is installed.
		if ( mw.config.get( 'wgCiteResponsiveReferences' ) ) {
			this.mwKeymapRegistry.insert.reference = {
				key: 'Mod-K',
				run: this.reference.bind( this )
			};
		}
	}

	/**
	 * @type {CodeMirrorTextSelection}
	 */
	get textSelection() {
		return this.cm.textSelection;
	}

	/**
	 * Register each {@link CodeMirrorKeyBinding} with {@link CodeMirrorKeymap},
	 * and make the key bindings immediately available in the editor.
	 *
	 * @internal
	 */
	registerKeyBindings() {
		for ( const section in this.mwKeymapRegistry ) {
			for ( const command in this.mwKeymapRegistry[ section ] ) {
				const keyBinding = this.mwKeymapRegistry[ section ][ command ];
				this.keymap.registerKeyBindingHelp( section, command, keyBinding, this.view );
			}
		}

		// Open links
		this.keymap.cursorModifiers.set( 'openLinks', mw.msg(
			'codemirror-keymap-openlinks',
			this.keymap.getShortcutHtml( 'Mod' ).outerHTML
		) );
	}

	/**
	 * Bold the selected text.
	 *
	 * @return {boolean}
	 */
	bold() {
		this.textSelection.encapsulateSelection( {
			pre: "'''",
			peri: mw.msg( 'codemirror-keymap-bold' ),
			post: "'''"
		} );
		return true;
	}

	/**
	 * Italicize the selected text.
	 *
	 * @return {boolean}
	 */
	italic() {
		this.textSelection.encapsulateSelection( {
			pre: "''",
			peri: mw.msg( 'codemirror-keymap-italic' ),
			post: "''"
		} );
		return true;
	}

	/**
	 * Insert a link.
	 *
	 * @return {boolean}
	 */
	link() {
		// Use WikiEditor's insert dialog if available.
		if ( this.wikiEditor ) {
			// TODO: Replace with Codex-ified CodeMirror variant
			this.wikiEditor.api.openDialog( this.wikiEditor, 'insert-link' );
			return true;
		}
		this.textSelection.encapsulateSelection( {
			pre: '[[',
			peri: mw.msg( 'codemirror-keymap-link' ),
			post: ']]'
		} );
		return true;
	}

	/**
	 * Format the selected text as computer code.
	 *
	 * @return {boolean}
	 */
	computerCode() {
		this.textSelection.encapsulateSelection( {
			pre: '<code>',
			peri: mw.msg( 'codemirror-keymap-computercode' ),
			post: '</code>'
		} );
		return true;
	}

	/**
	 * Format the selected text as strikethrough.
	 *
	 * @return {boolean}
	 */
	strikethrough() {
		this.textSelection.encapsulateSelection( {
			pre: '<s>',
			peri: mw.msg( 'codemirror-keymap-strikethrough' ),
			post: '</s>'
		} );
		return true;
	}

	/**
	 * Format the selected text as subscript.
	 *
	 * @return {boolean}
	 */
	subscript() {
		this.textSelection.encapsulateSelection( {
			pre: '<sub>',
			peri: mw.msg( 'codemirror-keymap-subscript' ),
			post: '</sub>'
		} );
		return true;
	}

	/**
	 * Format the selected text as superscript.
	 *
	 * @return {boolean}
	 */
	superscript() {
		this.textSelection.encapsulateSelection( {
			pre: '<sup>',
			peri: mw.msg( 'codemirror-keymap-superscript' ),
			post: '</sup>'
		} );
		return true;
	}

	/**
	 * Format the selected text as underlined.
	 *
	 * @return {boolean}
	 */
	underline() {
		this.textSelection.encapsulateSelection( {
			pre: '<u>',
			peri: mw.msg( 'codemirror-keymap-underline' ),
			post: '</u>'
		} );
		return true;
	}

	/**
	 * Treat the selected text as unformatted wikitext.
	 *
	 * @return {boolean}
	 */
	nowiki() {
		this.textSelection.encapsulateSelection( {
			pre: '<nowiki>',
			peri: mw.msg( 'codemirror-keymap-nowiki' ),
			post: '</nowiki>'
		} );
		return true;
	}

	/**
	 * Format the selected text as preformatted.
	 *
	 * @return {boolean}
	 */
	preformatted() {
		this.textSelection.encapsulateSelection( {
			pre: ' ',
			peri: mw.msg( 'codemirror-keymap-preformatted' ),
			splitlines: true
		} );
		return true;
	}

	/**
	 * Format the selected text as a blockquote.
	 *
	 * @return {boolean}
	 */
	blockquote() {
		this.textSelection.encapsulateSelection( {
			pre: '<blockquote>',
			peri: mw.msg( 'codemirror-keymap-blockquote' ),
			post: '</blockquote>'
		} );
		return true;
	}

	/**
	 * Change the current line to be a heading of the specified level.
	 *
	 * @param {number} level
	 * @return {boolean}
	 */
	heading( level ) {
		const syntax = '='.repeat( level );
		const options = {
			pre: syntax + ' ',
			peri: mw.msg( 'codemirror-keymap-heading-n', level ),
			post: ' ' + syntax,
			splitlines: true
		};
		// If there's only one line, replace it with the new heading syntax.
		if ( !this.textSelection.getSelection().includes( '\n' ) ) {
			// Get the text of the current line block, stripping any existing heading syntax.
			const { from, length } = this.view.lineBlockAt( this.textSelection.getCaretPosition() );
			options.peri = this.view.state.doc.sliceString( from, from + length )
				.replace( /^=+|=+$/g, '' )
				.trim() || options.peri;
			// Replace the current line block with the new text.
			options.selectionStart = from;
			options.selectionEnd = from + length;
			options.replace = true;
		}
		this.textSelection.encapsulateSelection( options );
		return true;
	}

	/**
	 * Insert a reference.
	 *
	 * @return {boolean}
	 */
	reference() {
		this.textSelection.encapsulateSelection( {
			pre: '<ref>',
			post: '</ref>'
		} );
		return true;
	}

	/**
	 * Insert or toggle a comment around the selected text.
	 *
	 * @return {boolean}
	 */
	comment() {
		this.textSelection.encapsulateSelection( {
			pre: '<!-- ',
			peri: mw.msg( 'codemirror-keymap-comment' ),
			post: ' -->'
		} );
		return true;
	}
}

/**
 * Register MediaWiki-specific key bindings with CodeMirror.
 * This is automatically called when using {@link CodeMirrorModeMediaWiki}.
 *
 * @member CodeMirrorMediaWikiKeymap
 * @method
 * @param {CodeMirror} cm
 */
module.exports = ( cm ) => {
	const mwKeymap = new CodeMirrorMediaWikiKeymap( cm );
	mwKeymap.registerKeyBindings();
};
