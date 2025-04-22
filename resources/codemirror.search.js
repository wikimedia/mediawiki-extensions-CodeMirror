const {
	EditorView,
	SearchQuery,
	closeSearchPanel,
	findNext,
	findPrevious,
	getSearchQuery,
	keymap,
	openSearchPanel,
	replaceAll,
	replaceNext,
	runScopeHandlers,
	search,
	selectMatches,
	selectNextOccurrence,
	selectSelectionMatches,
	setSearchQuery
} = require( 'ext.CodeMirror.v6.lib' );
const CodeMirrorPanel = require( './codemirror.panel.js' );

/**
 * Custom search panel for CodeMirror using CSS-only Codex components.
 *
 * @extends CodeMirrorPanel
 */
class CodeMirrorSearch extends CodeMirrorPanel {
	constructor() {
		super();

		/**
		 * @type {SearchQuery}
		 */
		this.searchQuery = {
			search: ''
		};
		/**
		 * @type {HTMLInputElement}
		 */
		this.searchInput = undefined;
		/**
		 * @type {HTMLDivElement}
		 */
		this.searchInputWrapper = undefined;
		/**
		 * @type {HTMLInputElement}
		 */
		this.replaceInput = undefined;
		/**
		 * @type {HTMLButtonElement}
		 */
		this.matchCaseButton = undefined;
		/**
		 * @type {HTMLButtonElement}
		 */
		this.regexpButton = undefined;
		/**
		 * @type {HTMLButtonElement}
		 */
		this.wholeWordButton = undefined;
		/**
		 * @type {HTMLButtonElement}
		 */
		this.nextButton = undefined;
		/**
		 * @type {HTMLButtonElement}
		 */
		this.prevButton = undefined;
		/**
		 * @type {HTMLButtonElement}
		 */
		this.allButton = undefined;
		/**
		 * @type {HTMLButtonElement}
		 */
		this.replaceButton = undefined;
		/**
		 * @type {HTMLButtonElement}
		 */
		this.replaceAllButton = undefined;
		/**
		 * @type {HTMLButtonElement}
		 */
		this.doneButton = undefined;
		/**
		 * @type {HTMLSpanElement}
		 */
		this.findResultsText = undefined;
	}

	/**
	 * @inheritDoc
	 */
	get extension() {
		return [
			search( {
				createPanel: ( view ) => {
					/**
					 * Fired when the CodeMirror search panel is opened.
					 *
					 * @event CodeMirror~ext.CodeMirror.search
					 * @internal
					 */
					mw.hook( 'ext.CodeMirror.search' ).fire();
					this.view = view;
					return this.panel;
				}
			} ),
			keymap.of( [
				{ key: 'Mod-f', run: this.openPanel.bind( this ), scope: 'editor search-panel' },
				{ key: 'F3', run: this.findNext.bind( this ), shift: this.findPrevious.bind( this ), scope: 'editor search-panel', preventDefault: true },
				{ key: 'Mod-g', run: this.findNext.bind( this ), shift: this.findPrevious.bind( this ), scope: 'editor search-panel', preventDefault: true },
				{ key: 'Escape', run: closeSearchPanel, scope: 'editor search-panel' },
				{ key: 'Mod-Shift-l', run: selectSelectionMatches },
				{ key: 'Mod-d', run: selectNextOccurrence, preventDefault: true }
			] )
		];
	}

	/**
	 * @inheritDoc
	 */
	get panel() {
		const container = document.createElement( 'div' );
		container.className = 'cm-mw-panel cm-mw-panel--search-panel';
		container.addEventListener( 'keydown', this.onKeydown.bind( this ) );

		const firstRow = document.createElement( 'div' );
		firstRow.className = 'cm-mw-panel--row';
		container.appendChild( firstRow );

		// Search input.
		const [ searchInputWrapper, searchInput ] = this.getTextInput(
			'search',
			this.searchQuery.search || this.view.state.sliceDoc(
				this.view.state.selection.main.from,
				this.view.state.selection.main.to
			),
			'codemirror-find'
		);
		this.searchInput = searchInput;
		this.searchInput.setAttribute( 'main-field', 'true' );
		this.searchInputWrapper = searchInputWrapper;
		this.findResultsText = document.createElement( 'span' );
		this.findResultsText.className = 'cm-mw-find-results';
		this.searchInputWrapper.appendChild( this.findResultsText );
		firstRow.appendChild( this.searchInputWrapper );

		this.appendPrevAndNextButtons( firstRow );

		// "All" button.
		this.allButton = this.getButton( 'codemirror-all' );
		this.allButton.title = mw.msg( 'codemirror-all-tooltip' );
		this.allButton.addEventListener( 'click', ( e ) => {
			e.preventDefault();
			selectMatches( this.view );
		} );
		firstRow.appendChild( this.allButton );

		this.appendSearchOptions( firstRow );
		this.appendSecondRow( container );

		return {
			dom: container,
			top: true,
			mount: () => {
				this.searchInput.focus();
				this.searchInput.select();
			}
		};
	}

	/**
	 * Open the search panel.
	 *
	 * @param {EditorView} view
	 * @return {boolean}
	 */
	openPanel( view ) {
		openSearchPanel( view );
		this.commit();
		return true;
	}

	/**
	 * @param {HTMLDivElement} firstRow
	 * @private
	 */
	appendPrevAndNextButtons( firstRow ) {
		const buttonGroup = document.createElement( 'div' );
		buttonGroup.className = 'cdx-button-group';

		// "Previous" button.
		this.prevButton = this.getButton( 'codemirror-previous', 'previous', true );
		buttonGroup.appendChild( this.prevButton );
		this.prevButton.addEventListener( 'click', ( e ) => {
			e.preventDefault();
			this.findPrevious();
		} );

		// "Next" button.
		this.nextButton = this.getButton( 'codemirror-next', 'next', true );
		buttonGroup.appendChild( this.nextButton );
		this.nextButton.addEventListener( 'click', ( e ) => {
			e.preventDefault();
			this.findNext();
		} );

		firstRow.appendChild( buttonGroup );
	}

	/**
	 * @param {HTMLDivElement} firstRow
	 * @private
	 */
	appendSearchOptions( firstRow ) {
		const buttonGroup = document.createElement( 'div' );
		buttonGroup.className = 'cdx-toggle-button-group';

		// "Match case" ToggleButton.
		this.matchCaseButton = this.getToggleButton(
			'case',
			'codemirror-match-case',
			'match-case',
			this.searchQuery.caseSensitive
		);
		buttonGroup.appendChild( this.matchCaseButton );

		// "Regexp" ToggleButton.
		this.regexpButton = this.getToggleButton(
			'regexp',
			'codemirror-regexp',
			'regexp',
			this.searchQuery.regexp
		);
		buttonGroup.appendChild( this.regexpButton );

		// "Whole word" ToggleButton.
		this.wholeWordButton = this.getToggleButton(
			'word',
			'codemirror-by-word',
			'quotes',
			this.searchQuery.wholeWord
		);
		buttonGroup.appendChild( this.wholeWordButton );

		firstRow.appendChild( buttonGroup );
	}

	/**
	 * @param {HTMLDivElement} container
	 * @private
	 */
	appendSecondRow( container ) {
		const shouldBeDisabled = this.view.state.readOnly;
		const row = document.createElement( 'div' );
		row.className = 'cm-mw-panel--row';
		container.appendChild( row );

		// Replace input.
		const [ replaceInputWrapper, replaceInput ] = this.getTextInput(
			'replace',
			this.searchQuery.replace || '',
			'codemirror-replace-placeholder'
		);
		this.replaceInput = replaceInput;
		this.replaceInput.disabled = shouldBeDisabled;
		row.appendChild( replaceInputWrapper );

		// "Replace" button.
		this.replaceButton = this.getButton( 'codemirror-replace' );
		this.replaceButton.disabled = shouldBeDisabled;
		row.appendChild( this.replaceButton );
		this.replaceButton.addEventListener( 'click', ( e ) => {
			e.preventDefault();
			replaceNext( this.view );
			this.updateNumMatchesText();
		} );

		// "Replace all" button.
		this.replaceAllButton = this.getButton( 'codemirror-replace-all' );
		this.replaceAllButton.disabled = shouldBeDisabled;
		row.appendChild( this.replaceAllButton );
		this.replaceAllButton.addEventListener( 'click', ( e ) => {
			e.preventDefault();
			replaceAll( this.view );
			this.updateNumMatchesText();
		} );

		// "Done" button.
		this.doneButton = this.getButton( 'codemirror-done' );
		row.appendChild( this.doneButton );
		this.doneButton.addEventListener( 'click', ( e ) => {
			e.preventDefault();
			closeSearchPanel( this.view );
			this.view.focus();
		} );
	}

	/**
	 * Respond to keydown events.
	 *
	 * @param {KeyboardEvent} event
	 * @private
	 */
	onKeydown( event ) {
		if ( runScopeHandlers( this.view, event, 'search-panel' ) ) {
			event.preventDefault();
			return;
		}

		if ( this.view.state.readOnly ) {
			// Use normal tab behaviour if the editor is read-only.
			return;
		}

		if ( event.key === 'Enter' && event.target === this.searchInput ) {
			event.preventDefault();
			( event.shiftKey ? this.findPrevious : this.findNext ).call( this );
		} else if ( event.key === 'Enter' && event.target === this.replaceInput ) {
			event.preventDefault();
			replaceNext( this.view );
			this.updateNumMatchesText();
		} else if ( event.key === 'Tab' ) {
			if ( !event.shiftKey && event.target === this.searchInput ) {
				// Tabbing from the search input should focus the replaceInput.
				event.preventDefault();
				this.replaceInput.focus();
			} else if ( event.shiftKey && event.target === this.replaceInput ) {
				// Shift+Tabbing from the replaceInput should focus the searchInput.
				event.preventDefault();
				this.searchInput.focus();
			} else if ( !event.shiftKey && event.target === this.doneButton ) {
				// Tabbing from the "Done" button should focus the prevButton.
				event.preventDefault();
				this.prevButton.focus();
			} else if ( !event.shiftKey && event.target === this.wholeWordButton ) {
				// Tabbing from the "Whole word" button should focus the editor,
				// or the next focusable panel if there is one.
				event.preventDefault();
				const el = this.view.dom.querySelector( '.cm-mw-panel--search-panel' );
				if ( el && el.nextElementSibling && el.nextElementSibling.classList.contains( 'cm-panel' ) ) {
					const input = el.nextElementSibling.querySelector( 'input' );
					( input || el.nextElementSibling ).focus();
				} else {
					this.view.focus();
				}
			}
		}
	}

	/**
	 * Create a new {@link SearchQuery} and dispatch it to the {@link EditorView}.
	 *
	 * @private
	 */
	commit() {
		const query = new SearchQuery( {
			search: this.searchInput.value,
			caseSensitive: this.matchCaseButton.dataset.checked === 'true',
			regexp: this.regexpButton.dataset.checked === 'true',
			wholeWord: this.wholeWordButton.dataset.checked === 'true',
			replace: this.replaceInput.value,
			// Makes i.e. "\n" match the literal string "\n" instead of a newline.
			literal: true
		} );
		if ( !query.eq( getSearchQuery( this.view.state ) ) || !query.eq( this.searchQuery ) ) {
			this.searchQuery = query;
			this.view.dispatch( {
				effects: setSearchQuery.of( query )
			} );
		}
		this.updateNumMatchesText( query );
	}

	/**
	 * Find the previous match.
	 *
	 * @return {boolean} Whether a match was found.
	 * @private
	 */
	findPrevious() {
		const ret = findPrevious( this.view );
		this.updateNumMatchesText();
		return ret;
	}

	/**
	 * Find the next match.
	 *
	 * @return {boolean} Whether a match was found.
	 * @private
	 */
	findNext() {
		const ret = findNext( this.view );
		this.updateNumMatchesText();
		return ret;
	}

	/**
	 * Show the number of matches for the given {@link SearchQuery}
	 * and the index of the current match in the find input.
	 *
	 * @param {SearchQuery} [query]
	 * @private
	 */
	updateNumMatchesText( query ) {
		if ( !!this.searchQuery.search && this.searchQuery.regexp && !this.searchQuery.valid ) {
			this.searchInputWrapper.classList.add( 'cdx-text-input--status-error' );
			this.findResultsText.textContent = mw.msg( 'codemirror-regexp-invalid' );
			return;
		}
		const cursor = query ?
			query.getCursor( this.view.state ) :
			getSearchQuery( this.view.state ).getCursor( this.view.state );

		// Clear error state
		this.searchInputWrapper.classList.remove( 'cdx-text-input--status-error' );

		// Remove messaging if there's no search query.
		if ( !this.searchQuery.search ) {
			this.findResultsText.textContent = '';
			return;
		}

		let count = 0,
			current = 1;
		const { from, to } = this.view.state.selection.main;
		let item = cursor.next();
		while ( !item.done ) {
			if ( item.value.from === from && item.value.to === to ) {
				current = count + 1;
			}
			item = cursor.next();
			count++;
		}
		this.findResultsText.textContent = count ?
			mw.msg( 'codemirror-find-results', current, count ) :
			'';
	}

	/**
	 * @inheritDoc
	 */
	getButton( label, icon = null, iconOnly = false ) {
		const button = super.getButton( label, icon, iconOnly );
		// The following CSS classes may be used here:
		// * cm-mw-panel--search__all
		// * cm-mw-panel--search__replace
		// * cm-mw-panel--search__replace-all
		// * cm-mw-panel--search__done
		button.classList.add( `cm-mw-panel--search__${ label.replace( 'codemirror-', '' ) }` );
		return button;
	}

	/**
	 * @inheritDoc
	 */
	getTextInput( name, value = '', placeholder = '' ) {
		const [ container, input ] = super.getTextInput( name, value, placeholder );
		input.autocomplete = 'off';
		input.addEventListener( 'change', this.commit.bind( this ) );
		input.addEventListener( 'keyup', this.commit.bind( this ) );
		return [ container, input ];
	}

	/**
	 * @inheritDoc
	 */
	getToggleButton( name, label, icon, checked = false ) {
		const button = super.getToggleButton( name, label, icon, checked );
		button.addEventListener( 'click', this.commit.bind( this ) );
		return button;
	}
}

module.exports = CodeMirrorSearch;
