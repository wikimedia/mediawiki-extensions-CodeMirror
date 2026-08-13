const {
	Decoration,
	Direction,
	EditorState,
	EditorView,
	Extension,
	LanguageSupport,
	StateEffect,
	StateEffectType,
	StateField
} = require( 'ext.CodeMirror.lib' );
const CodeMirror = require( 'ext.CodeMirror' );
const CodeMirrorVisualEditorOpenLinks = require( './codemirror.visualEditorOpenLinks.js' );

/**
 * Marks the link a modifier-click would open. CodeMirror nests this around the mode's own token
 * span rather than merging the classes, so the stylesheet has to reach the descendant to beat
 * the token's `color`.
 *
 * @type {Decoration}
 * @private
 */
const openLinkDecoration = Decoration.mark( { class: 'cm-mw-ve-openLinkToken' } );

/**
 * Moves {@link openLinkDecoration} to a source range, or clears it when given null.
 *
 * @type {StateEffectType}
 * @private
 */
const setOpenLink = StateEffect.define();

/**
 * Holds the open-link mark. A StateField updated by a StateEffect, rather than a Compartment
 * reconfigured each time: the mark follows the pointer, and reconfiguring rebuilds the editor's
 * configuration, which is meant for occasional changes. Measured at roughly twice the cost per
 * update even without a browser's share of the work.
 *
 * @type {StateField}
 * @private
 */
const openLinkField = StateField.define( {
	create: () => Decoration.none,
	update: ( marks, transaction ) => {
		for ( const effect of transaction.effects ) {
			if ( effect.is( setOpenLink ) ) {
				return effect.value ?
					Decoration.set( [
						openLinkDecoration.range( effect.value.from, effect.value.to )
					] ) :
					Decoration.none;
			}
		}
		return marks.map( transaction.changes );
	},
	provide: ( field ) => EditorView.decorations.from( field )
} );

/**
 * CodeMirror integration for the VisualEditor
 * {@link https://www.mediawiki.org/wiki/Special:MyLanguage/2017_wikitext_editor 2017 wikitext editor}.
 *
 * @extends CodeMirror
 */
class CodeMirrorVisualEditor extends CodeMirror {
	/**
	 * @param {ve.ui.Surface} surface
	 * @param {LanguageSupport} langSupport
	 */
	constructor( surface, langSupport = [] ) {
		super( surface, langSupport );

		/**
		 * The ContentEditable surface.
		 *
		 * @type {ve.ce.Surface}
		 */
		this.surfaceView = this.surface.getView();
		/**
		 * Whether modifier-clicking a link opens it, from the user's `openLinks` preference.
		 *
		 * @type {boolean}
		 */
		this.openLinksEnabled = !!this.langExtension.openLinks &&
			!!this.preferences.getPreference( 'openLinks' );
		/**
		 * Modifier-click link opening, driven by VisualEditor's mouse events: the overlay is
		 * `pointer-events: none`, so CodeMirror's own openLinks extension never fires here.
		 *
		 * @type {CodeMirrorVisualEditorOpenLinks|null}
		 */
		this.openLinks = this.langExtension.openLinks ?
			new CodeMirrorVisualEditorOpenLinks( surface, Object.assign( {
				getState: () => this.state,
				drawLink: this.drawOpenLink.bind( this ),
				clearLink: this.clearOpenLink.bind( this )
			}, this.langExtension.openLinks ) ) :
			null;
	}

	/**
	 * The VisualEditor surface.
	 *
	 * @type {ve.ui.Surface}
	 */
	get surface() {
		return this.textarea;
	}

	/**
	 * @inheritDoc
	 */
	get readOnly() {
		return this.surface.getModel().isReadOnly();
	}

	/**
	 * Extensions supported by the 2017 wikitext editor.
	 * Do *not* include Extensions that make changes to the document text, or visually
	 * change the placement of text. These are what the page menu's preferences tool
	 * ({@link ve.ui.CodeMirrorPreferencesTool}) offers there.
	 *
	 * @inheritDoc
	 */
	get extensionRegistryDefaults() {
		const extensions = {
			activeLine: this.activeLineExtension,
			bracketMatching: this.bracketMatchingExtension,
			lineNumbering: this.lineNumberingExtension,
			trailingWhitespace: this.trailingWhitespaceExtension,
			whitespace: this.whitespaceExtension
		};
		// Only offer to mark links if the mode can find them.
		if ( this.langExtension.openLinks ) {
			extensions.openLinks = this.openLinksExtension;
		}
		// DiscussionTools has no line numbers, so don't offer the preference there either.
		if ( this.surface.getTarget().constructor.name === 'CommentTarget' ) {
			delete extensions.lineNumbering;
		}
		return extensions;
	}

	/**
	 * The same constraint as {@link CodeMirrorVisualEditor#extensionRegistryDefaults}, applied
	 * to anything registered after construction. `highlightRefs` and `theme` are permitted but
	 * not seeded there, as the language pack and {@link CodeMirrorThemes} register those once
	 * there is a view.
	 *
	 * @inheritDoc
	 */
	get supportedExtensions() {
		return [
			'activeLine',
			'bracketMatching',
			'highlightRefs',
			'lineNumbering',
			'openLinks',
			'theme',
			'trailingWhitespace',
			'whitespace'
		];
	}

	/**
	 * Holds the mark for the link under the pointer. Registered like any other preference, so
	 * the registry turns it on and off with `openLinks`; the range itself moves by effect.
	 *
	 * @type {Extension}
	 * @protected
	 */
	get openLinksExtension() {
		return openLinkField;
	}

	/**
	 * @inheritDoc
	 */
	get defaultExtensions() {
		return [
			this.contentAttributesExtension,
			this.editorAttributesExtension,
			this.heightExtension,
			this.updateExtension,
			this.dirExtension,
			this.preferences.extension,
			EditorState.readOnly.of( this.readOnly ),
			this.langExtension,
			EditorView.theme( {
				'.cm-content': {
					lineHeight: 1.5
				},
				'&': {
					padding: window.getComputedStyle(
						this.surfaceView.$attachedRootNode[ 0 ]
					).padding
				}
			} )
		];
	}

	/**
	 * @inheritDoc
	 */
	get heightExtension() {
		return EditorView.theme( {
			'&': {
				height: '100%'
			}
		} );
	}

	/**
	 * @inheritDoc
	 */
	get contentAttributesExtension() {
		// Add colorblind mode if preference is set.
		// This currently is only to be used for the MediaWiki markup language.
		const useColorBlind = mw.user.options.get( 'usecodemirror-colorblind' ) &&
			mw.config.get( 'cmMode' ) === 'mediawiki';

		return EditorView.contentAttributes.of( {
			class: useColorBlind ? 'cm-mw-colorblind-colors' : '',
			spellcheck: 'true',
			// Disable tabbing to content editable (T412827)
			inert: 'true',
			// Fallback for browsers not supporting inert
			tabindex: '-1'
		} );
	}

	/**
	 * Preferences this integration honours, for {@link ve.ui.CodeMirrorPreferencesPage}.
	 *
	 * @type {string[]}
	 */
	get supportedPreferences() {
		return this.extensionRegistry.names;
	}

	/**
	 * Apply a preference to the running editor. toggle() reconfigures from the value map when
	 * given a string, so this covers both switches and choices.
	 *
	 * @param {string} name
	 * @param {PrefValue} value
	 */
	applyPreference( name, value ) {
		this.extensionRegistry.toggle( name, this, value );
		// Adding or removing the gutter moves where CodeMirror's text starts.
		if ( name === 'lineNumbering' && this.isActive ) {
			this.updateGutterWidth( this.surfaceView.getDocument().getDir() );
		}
		// The registry only holds the mark. Opening a link is VisualEditor's own event.
		if ( name === 'openLinks' && this.openLinks ) {
			this.openLinksEnabled = !!value;
			this.openLinks.setEnabled( this.isActive && this.openLinksEnabled );
		}
	}

	/**
	 * @inheritDoc
	 */
	getSourceContents() {
		return this.surface.getDom();
	}

	/**
	 * The surface's attached root, so the overlay is added beside VisualEditor's text and
	 * not inside it. VisualEditor reconciles that subtree, and the stylesheets hide its
	 * text, which would take the overlay with it.
	 *
	 * @inheritDoc
	 */
	get wrappedElement() {
		return this.surfaceView.$attachedRootNode[ 0 ];
	}

	/**
	 * @inheritDoc
	 */
	initialize( extensions = this.defaultExtensions ) {
		if ( this.surface.getMode() !== 'source' ) {
			mw.log.warn( '[CodeMirror] Attempted to initialize CodeMirrorVisualEditor in non-source mode.' );
			return;
		}
		super.initialize( extensions );
	}

	/**
	 * @inheritDoc
	 */
	addEditRecoveryHandler() {}

	/**
	 * @inheritDoc
	 */
	addTextAreaJQueryHook() {}

	/**
	 * @inheritDoc
	 */
	addFormSubmitHandler() {}

	/**
	 * Focus is always given to the VE surface, which relays it to CodeMirror.
	 *
	 * @inheritDoc
	 */
	focus() {
		this.surfaceView.focus();
	}

	/**
	 * @inheritDoc
	 */
	get hasFocus() {
		return this.surfaceView.isFocused();
	}

	/**
	 * @inheritDoc
	 */
	activate() {
		super.activate();

		// Force infinite viewport in CodeMirror to prevent misalignment of
		// the VE surface and the CodeMirror view. See T357482#10076432.
		this.view.viewState.printing = true;

		const profile = $.client.profile();
		const supportsTransparentText = 'WebkitTextFillColor' in document.body.style &&
			// Disable on Firefox+OSX (T175223)
			!( profile.layout === 'gecko' && profile.platform === 'mac' );

		this.surfaceView.$documentNode.addClass(
			supportsTransparentText ?
				've-ce-documentNode-codeEditor-webkit-hide' :
				've-ce-documentNode-codeEditor-hide'
		);

		// The VE/CM overlay technique only works with monospace fonts
		// (as we use width-changing bold as a highlight) so revert any editfont user preference
		this.surfaceView.$element.removeClass( 'mw-editfont-sans-serif mw-editfont-serif' )
			.addClass( 'mw-editfont-monospace' );

		// Account for the gutter width in the margin.
		this.updateGutterWidth( this.surfaceView.getDocument().getDir() );

		// As the action is regenerated each time,
		// we need to track the listeners for later disconnection.

		/**
		 * @type {Function}
		 * @private
		 */
		this.transactionListener = this.onDocumentPrecommit.bind( this );
		this.surface.getModel().getDocument().on( 'precommit', this.transactionListener );
		/**
		 * @type {Function}
		 * @private
		 */
		this.selectListener = this.onSelect.bind( this );
		this.surface.getModel().on( 'select', this.selectListener );
		/**
		 * @type {Function}
		 * @private
		 */
		this.positionListener = this.onPosition.bind( this );
		this.surfaceView.on( 'position', this.positionListener );

		if ( this.openLinks ) {
			this.openLinks.setEnabled( this.openLinksEnabled );
		}

		// Sync document directionality changes to CodeMirror.
		this.onPosition();
	}

	/**
	 * There is no hidden textarea, and VE owns the selection and scroll position.
	 *
	 * @inheritDoc
	 */
	restoreSelectionAndScrollPosition() {}

	/**
	 * @inheritDoc
	 */
	syncEditorContentsToSource() {}

	/**
	 * @inheritDoc
	 */
	syncSelectionAndScrollPosition() {}

	/**
	 * @inheritDoc
	 */
	deactivate() {
		// Before the parent hides the view, so the mark is cleared while it is still shown.
		if ( this.openLinks ) {
			this.openLinks.setEnabled( false );
		}

		super.deactivate();

		this.surfaceView.$documentNode.removeClass(
			've-ce-documentNode-codeEditor-webkit-hide ve-ce-documentNode-codeEditor-hide'
		);

		// Restore edit-font
		// eslint-disable-next-line mediawiki/class-doc
		this.surfaceView.$element.removeClass( 'mw-editfont-monospace' )
			.addClass( 'mw-editfont-' + mw.user.options.get( 'editfont' ) );

		// Reset gutter.
		const margins = {
			'margin-left': '',
			'margin-right': ''
		};
		this.surfaceView.$documentNode.css( margins );

		this.surface.getModel().getDocument().off( 'precommit', this.transactionListener );
		this.surface.getModel().off( 'select', this.selectListener );
		this.surfaceView.off( 'position', this.positionListener );
	}

	/**
	 * Log usage of CodeMirror to the VisualEditorFeatureUse schema.
	 *
	 * @see https://phabricator.wikimedia.org/T373710
	 * @see https://meta.wikimedia.org/wiki/Schema:VisualEditorFeatureUse
	 * @see https://www.mediawiki.org/wiki/VisualEditor/FeatureUse_data_dictionary
	 * @inheritDoc
	 */
	logEditFeature( action ) {
		mw.track( 'visualEditorFeatureUse', { feature: 'codemirror', action } );
	}

	/**
	 * @inheritDoc
	 */
	setupFeatureLogging() {}

	/**
	 * @inheritDoc
	 */
	destroy() {
		super.destroy();
		if ( this.openLinks ) {
			this.openLinks.destroy();
		}
	}

	/**
	 * Mark the link a modifier-click would open. The overlay carries the visible text, so this
	 * is a CodeMirror decoration rather than one of VisualEditor's highlights.
	 *
	 * @param {number} from Source offset
	 * @param {number} to Source offset
	 * @return {boolean} Whether the mark was drawn
	 * @private
	 */
	drawOpenLink( from, to ) {
		if ( !this.view || from >= to ) {
			return false;
		}
		this.dispatch( { effects: setOpenLink.of( { from, to } ) } );
		return true;
	}

	/**
	 * Remove the open-link mark.
	 *
	 * @private
	 */
	clearOpenLink() {
		if ( !this.view ) {
			return;
		}
		this.dispatch( { effects: setOpenLink.of( null ) } );
	}

	/**
	 * Update margins to account for the CodeMirror gutter.
	 *
	 * @param {string} dir Document direction
	 * @private
	 */
	updateGutterWidth( dir ) {
		const gutter = this.view.dom.querySelector( '.cm-gutters' );
		// Zero when line numbering is disabled: the offsets have to be cleared rather than
		// left alone, or the surface stays indented by a gutter that is no longer there.
		const guttersWidth = gutter ? gutter.getBoundingClientRect().width : 0;
		const margins = {
			'margin-left': dir === 'rtl' ? 0 : guttersWidth,
			'margin-right': dir === 'rtl' ? guttersWidth : 0
		};
		this.surfaceView.$documentNode.css( margins );
		// Also update width of .cm-content due to apparent Chromium bug.
		this.view.contentDOM.style.width = guttersWidth ?
			'calc(100% - ' + guttersWidth + 'px)' :
			'';
	}

	/**
	 * Sync document directionality changes to CodeMirror.
	 *
	 * @private
	 */
	onPosition() {
		const veDir = this.surfaceView.getDocument().getDir();
		const cmDir = this.view.textDirection === Direction.LTR ? 'ltr' : 'rtl';

		if ( veDir !== cmDir ) {
			this.view.dispatch( {
				effects: this.dirCompartment.reconfigure(
					EditorView.editorAttributes.of( { dir: veDir } )
				)
			} );
			this.updateGutterWidth( veDir );
		}
	}

	/**
	 * Handle select events from the surface model.
	 *
	 * @param {ve.dm.Selection} selection
	 * @private
	 */
	onSelect( selection ) {
		const range = selection.getCoveringRange();

		if ( !range ) {
			return;
		}

		const model = this.surface.getModel(),
			// T382769: the selection range from `textSelection( 'setContents' )`
			// exceeds the document length.
			clamp = ( offset ) => Math.min(
				model.getSourceOffsetFromOffset( offset ),
				this.view.state.doc.length
			);

		// Mirror the whole selection, not just a collapsed cursor: highlightActiveLine marks
		// the line at the head. Bracket matching skips non-empty ranges of its own accord, so
		// it is unaffected.
		this.view.dispatch( {
			selection: {
				anchor: clamp( range.from ),
				head: clamp( range.to )
			}
		} );
	}

	/**
	 * Handle precommit events from the document.
	 *
	 * The document is still in it's 'old' state before the transaction
	 * has been applied at this point.
	 *
	 * @param {ve.dm.Transaction} tx
	 * @private
	 */
	onDocumentPrecommit( tx ) {
		const replacements = [],
			model = this.surface.getModel(),
			store = model.getDocument().getStore();
		let offset = 0;

		tx.operations.forEach( ( op ) => {
			if ( op.type === 'retain' ) {
				offset += op.length;
			} else if ( op.type === 'replace' ) {
				replacements.push( {
					from: model.getSourceOffsetFromOffset( offset ),
					to: model.getSourceOffsetFromOffset( offset + op.remove.length ),
					insert: new ve.dm.ElementLinearData( store, op.insert ).getSourceText()
				} );
				offset += op.remove.length;
			}
		} );

		// Apply replacements in reverse to avoid having to shift offsets
		for ( let i = replacements.length - 1; i >= 0; i-- ) {
			// T382769: the replacement range from `textSelection( 'setContents' )`
			// exceeds the document length by one character and inserts an extra newline
			const { from, to, insert } = replacements[ i ],
				isSetContents = to === this.view.state.doc.length + 1 &&
					insert.endsWith( '\n' );
			this.view.dispatch( {
				changes: {
					from,
					to: isSetContents ? to - 1 : to,
					insert: isSetContents ? insert.slice( 0, -1 ) : insert
				}
			} );
		}

		this.updateGutterWidth( this.surfaceView.getDocument().getDir() );
	}
}

/**
 * @module ext.CodeMirror.visualEditor
 * @description
 * This module provides CodeMirror integration for the 2017 wikitext editor that
 * is part of the VisualEditor extension. It exports the {@link CodeMirrorVisualEditor} class.
 * To be usable beyond a plain text editor, you will need to pass in a language mode to the
 * constructor. See {@link CodeMirrorVisualEditor} for more information.
 * @see CodeMirrorVisualEditor
 */
module.exports = CodeMirrorVisualEditor;
