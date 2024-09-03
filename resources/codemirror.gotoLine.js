const {
	EditorSelection,
	EditorView,
	Prec,
	StateEffect,
	StateEffectType,
	StateField,
	keymap,
	showPanel
} = require( 'ext.CodeMirror.v6.lib' );
const CodeMirrorPanel = require( './codemirror.panel.js' );

/**
 * Custom goto line panel for CodeMirror using CSS-only Codex components.
 *
 * Using the Alt-g keybinding, this shows a panel asking the user for a line number,
 * when a valid position is provided, moves the cursor to that line.
 *
 * This feature supports line numbers, relative line offsets prefixed with `+` or `-`,
 * document percentages suffixed with `%`, and an optional column position by adding `:`
 * and a second number after the line number.
 *
 * Based on the CodeMirror implementation (MIT).
 *
 * @see https://github.com/codemirror/search/blob/0d8af3e4cc/src/goto-line.ts
 * @extends CodeMirrorPanel
 */
class CodeMirrorGotoLine extends CodeMirrorPanel {
	constructor() {
		super();

		/**
		 * @type {StateEffectType}
		 */
		this.toggleEffect = StateEffect.define();

		/**
		 * @type {StateField}
		 */
		this.panelStateField = StateField.define( {
			create: () => true,
			update: ( value, transaction ) => {
				for ( const e of transaction.effects ) {
					if ( e.is( this.toggleEffect ) ) {
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
		 * @type {HTMLInputElement}
		 */
		this.input = undefined;
	}

	/**
	 * @inheritDoc
	 */
	get extension() {
		// Use Prec.highest to ensure that this keymap is used before the default searchKeymap.
		return Prec.highest(
			keymap.of( {
				key: 'Mod-Alt-g',
				run: ( view ) => {
					this.view = view;
					const effects = [ this.toggleEffect.of( true ) ];
					if ( !this.view.state.field( this.panelStateField, false ) ) {
						effects.push( StateEffect.appendConfig.of( [ this.panelStateField ] ) );
					}
					this.view.dispatch( { effects } );
					return true;
				}
			} )
		);
	}

	/**
	 * @inheritDoc
	 */
	get panel() {
		const container = document.createElement( 'div' );
		container.className = 'cm-mw-goto-line-panel cm-mw-panel cm-mw-panel--row';
		container.addEventListener( 'keydown', this.onKeydown.bind( this ) );

		// Line input.
		const [ inputWrapper, input ] = this.getTextInput( 'line', this.line );
		this.input = input;
		container.appendChild( inputWrapper );

		// Go button.
		const button = this.getButton( 'codemirror-goto-line-go' );
		button.addEventListener( 'click', this.go.bind( this ) );
		container.appendChild( button );

		return {
			dom: container,
			top: true,
			mount: () => {
				this.input.value = String(
					this.view.state.doc.lineAt(
						this.view.state.selection.main.head
					).number
				);
				this.input.focus();
				this.input.select();
			}
		};
	}

	/**
	 * Respond to keydown events.
	 *
	 * @param {KeyboardEvent} event
	 */
	onKeydown( event ) {
		if ( event.key === 'Escape' ) {
			event.preventDefault();
			this.view.dispatch( { effects: this.toggleEffect.of( false ) } );
			this.view.focus();
		} else if ( event.key === 'Enter' ) {
			event.preventDefault();
			this.go();
		}
	}

	/**
	 * Go to the specified line.
	 */
	go() {
		const match = /^([+-])?(\d+)?(:\d+)?(%)?$/.exec( this.input.value );
		if ( !match ) {
			return;
		}
		const { state } = this.view;
		const startLine = state.doc.lineAt( state.selection.main.head );
		const [ , sign, ln, cl, percent ] = match;
		const col = cl ? +cl.slice( 1 ) : 0;
		let line = ln ? +ln : startLine.number;
		if ( ln && percent ) {
			let pc = line / 100;
			if ( sign ) {
				pc = pc * ( sign === '-' ? -1 : 1 ) + ( startLine.number / state.doc.lines );
			}
			line = Math.round( state.doc.lines * pc );
		} else if ( ln && sign ) {
			line = line * ( sign === '-' ? -1 : 1 ) + startLine.number;
		}
		const docLine = state.doc.line( Math.max( 1, Math.min( state.doc.lines, line ) ) );
		const selection = EditorSelection.cursor(
			docLine.from + Math.max( 0, Math.min( col, docLine.length ) )
		);
		this.view.dispatch( {
			effects: [
				this.toggleEffect.of( false ),
				EditorView.scrollIntoView( selection.from, { y: 'center' } )
			],
			selection
		} );
		this.view.focus();
	}
}

module.exports = CodeMirrorGotoLine;
