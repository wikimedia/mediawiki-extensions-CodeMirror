const {
	EditorView,
	SearchQuery,
	closeSearchPanel,
	findNext,
	findPrevious,
	keymap,
	replaceAll,
	replaceNext,
	runScopeHandlers,
	search,
	searchKeymap,
	selectMatches,
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
	}

	/**
	 * @inheritDoc
	 */
	get extension() {
		return [
			search( {
				createPanel: ( view ) => {
					this.view = view;
					return this.panel;
				}
			} ),
			keymap.of( searchKeymap )
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
			this.searchQuery.search || '',
			'codemirror-find'
		);
		this.searchInput = searchInput;
		this.searchInput.setAttribute( 'main-field', 'true' );
		firstRow.appendChild( searchInputWrapper );

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
			findPrevious( this.view );
		} );

		// "Next" button.
		this.nextButton = this.getButton( 'codemirror-next', 'next', true );
		buttonGroup.appendChild( this.nextButton );
		this.nextButton.addEventListener( 'click', ( e ) => {
			e.preventDefault();
			findNext( this.view );
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
			're',
			'codemirror-regexp',
			'regexp',
			this.searchQuery.regexp
		);
		buttonGroup.appendChild( this.regexpButton );

		// "Whole word" checkbox.
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
		} );

		// "Replace all" button.
		this.replaceAllButton = this.getButton( 'codemirror-replace-all' );
		this.replaceAllButton.disabled = shouldBeDisabled;
		row.appendChild( this.replaceAllButton );
		this.replaceAllButton.addEventListener( 'click', ( e ) => {
			e.preventDefault();
			replaceAll( this.view );
		} );

		// "Done" button.
		const doneButton = this.getButton( 'codemirror-done' );
		row.appendChild( doneButton );
		doneButton.addEventListener( 'click', ( e ) => {
			e.preventDefault();
			closeSearchPanel( this.view );
			this.view.focus();
		} );
	}

	/**
	 * Respond to keydown events.
	 *
	 * @param {KeyboardEvent} event
	 */
	onKeydown( event ) {
		if ( runScopeHandlers( this.view, event, 'search-panel' ) ) {
			event.preventDefault();
		} else if ( event.key === 'Enter' && event.target === this.searchInput ) {
			event.preventDefault();
			( event.shiftKey ? findPrevious : findNext )( this.view );
		} else if ( event.key === 'Enter' && event.target === this.replaceInput ) {
			event.preventDefault();
			replaceNext( this.view );
		}
	}

	/**
	 * Create a new {@link SearchQuery} and dispatch it to the {@link EditorView}.
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
		if ( !this.searchQuery || !query.eq( this.searchQuery ) ) {
			this.searchQuery = query;
			this.view.dispatch( {
				effects: setSearchQuery.of( query )
			} );
		}
	}

	/**
	 * @inheritDoc
	 */
	getTextInput( name, value = '', placeholder = '' ) {
		const [ container, input ] = super.getTextInput( name, value, placeholder );
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
