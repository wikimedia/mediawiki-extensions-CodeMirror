const {
	keymap,
	linter,
	lintGutter,
	nextDiagnostic,
	setDiagnosticsEffect,
	showPanel,
	Diagnostic
} = require( 'ext.CodeMirror.lib' );
const CodeMirrorPanel = require( './codemirror.panel.js' );

/**
 * Provides linting support, including gutter markers and a status panel.
 *
 * @extends CodeMirrorPanel
 */
class CodeMirrorLint extends CodeMirrorPanel {

	/**
	 * Clicking on a diagnostic message will select the relevant code.
	 *
	 * @param {Diagnostic[]} diagnostics
	 * @param {boolean} readOnly Whether the editor is read-only
	 * @return {Diagnostic[]}
	 * @internal
	 * @ignore
	 */
	static renderDiagnostics( diagnostics, readOnly ) {
		return diagnostics.map( ( diagnostic ) => {
			const clickableDiagnostic = Object.assign( {}, diagnostic, {
				renderMessage( view ) {
					const span = document.createElement( 'span' );
					span.className = 'cm-diagnosticText-clickable';
					// TemplateStyles diagnostics already have a renderMessage method.
					if ( diagnostic.renderMessage ) {
						span.replaceChildren( diagnostic.renderMessage.call( this, view ) );
					} else {
						span.textContent = this.message;
					}
					span.addEventListener( 'click', () => {
						view.dispatch( {
							selection: { anchor: this.from, head: this.to }
						} );
					} );
					return span;
				}
			} );
			if ( readOnly ) {
				delete clickableDiagnostic.actions;
			}
			return clickableDiagnostic;
		} );
	}

	constructor( lintSource, codemirrorKeymap, lintApi, gotoLine ) {
		super();
		this.lintSource = lintSource;
		this.lintApi = lintApi;
		this.keymap = codemirrorKeymap;
		this.gotoLine = gotoLine;
		this.diagnostics = [];
	}

	get extension() {
		this.keymap.registerKeyBindingHelp( 'lint', 'next-diagnostic', { key: 'F8' } );

		// These extensions are only initialized when this.lintSource or this.lintApi are set,
		// or CodeMirror#applyLinter is called.
		const extension = [
			lintGutter(),
			keymap.of( [ { key: 'F8', run: nextDiagnostic } ] ),
			showPanel.of( ( view ) => {
				this.view = view;
				return this.panel;
			} )
		];
		if ( this.lintSource ) {
			extension.push( linter(
				async ( view ) => CodeMirrorLint.renderDiagnostics(
					await this.lintSource( view ),
					view.state.readOnly
				)
			) );
		}
		if ( this.lintApi ) {
			extension.push( linter(
				async ( view ) => CodeMirrorLint.renderDiagnostics(
					await this.lintApi( view ),
					view.state.readOnly
				)
			) );
		}
		return extension;
	}

	get panel() {
		const dom = document.createElement( 'div' );
		dom.className = 'cm-mw-panel--status';
		const worker = document.createElement( 'div' );
		worker.className = 'cm-mw-panel--status-worker';
		worker.addEventListener( 'click', () => {
			nextDiagnostic( this.view );
			this.view.focus();
		} );
		const [ error, errorText ] = this.getLintMarker( 'error' );
		const [ warning, warningText ] = this.getLintMarker( 'warning' );
		const [ info, infoText ] = this.getLintMarker( 'info' );
		worker.append( error, warning, info );
		const message = document.createElement( 'div' );
		message.className = 'cm-mw-panel--status-message';
		const position = document.createElement( 'div' );
		position.className = 'cm-mw-panel--status-line';
		this.updatePosition( this.view.state, position );
		position.addEventListener( 'click', () => this.gotoLine.openPanel( this.view ) );
		dom.append( worker, message, position );
		return {
			dom,
			update: ( update ) => {
				const { head } = update.state.selection.main;
				for ( const tr of update.transactions ) {
					for ( const effect of tr.effects ) {
						if ( effect.is( setDiagnosticsEffect ) ) {
							this.diagnostics = effect.value;
							this.updateDiagnosticsCount( 'error', errorText );
							this.updateDiagnosticsCount( 'warning', warningText );
							this.updateDiagnosticsCount( 'info', infoText );
							this.updateDiagnosticMessage( head, message );
						}
					}
				}
				if ( update.docChanged || update.selectionSet ) {
					this.updatePosition( update.state, position );
					this.updateDiagnosticMessage( head, message );
				}
			}
		};
	}

	getLintMarker( severity ) {
		// CSS class names known to be used here include:
		// * cm-mw-panel--status-error
		// * cm-mw-panel--status-warning
		// * cm-mw-panel--status-info
		const marker = document.createElement( 'div' );
		// eslint-disable-next-line mediawiki/class-doc
		marker.className = `cm-mw-panel--status-${ severity }`;
		const icon = document.createElement( 'div' );
		// eslint-disable-next-line mediawiki/class-doc
		icon.className = `cm-lint-marker-${ severity }`;
		const count = document.createElement( 'div' );
		count.textContent = '0';
		marker.prepend( icon, count );
		return [ marker, count ];
	}

	updateDiagnosticsCount( severity, count ) {
		count.textContent = this.diagnostics.filter( ( d ) => d.severity === severity ).length;
	}

	updateDiagnosticMessage( head, message ) {
		const diagnostic = this.diagnostics && this.diagnostics
			.find( ( d ) => d.from <= head && d.to >= head );
		if ( diagnostic ) {
			if ( diagnostic.renderMessage ) {
				const rendered = diagnostic.renderMessage( this.view );
				// Make the rendered message unclickable.
				if ( rendered instanceof Element &&
					rendered.classList.contains( 'cm-diagnosticText-clickable' )
				) {
					message.replaceChildren( ...rendered.childNodes );
				} else {
					message.replaceChildren( rendered );
				}
			} else {
				message.textContent = diagnostic.message;
			}
			if ( diagnostic.actions ) {
				message.append( ...diagnostic.actions.map( ( { name, tooltip, apply } ) => {
					const a = document.createElement( 'button' );
					a.type = 'button';
					a.className = 'cm-diagnosticAction';
					a.textContent = name;
					if ( tooltip ) {
						a.title = tooltip;
					}
					a.addEventListener( 'click', ( e ) => {
						e.preventDefault();
						apply( this.view, diagnostic.from, diagnostic.to );
					} );
					return a;
				} ) );
			}
		} else {
			message.textContent = '';
		}
	}

	updatePosition( state, position ) {
		const { anchor, head } = state.selection.main,
			line = state.doc.lineAt( head ),
			col = head - line.from;
		position.textContent = `${ line.number }:${ col }`;
		if ( anchor !== head ) {
			const line2 = state.doc.lineAt( anchor ),
				col2 = anchor - line2.from;
			if ( anchor < head ) {
				position.textContent += `|(${ line.number - line2.number }:${ Math.max( col - col2, 0 ) })`;
			} else {
				position.textContent += `|(${ line2.number - line.number }:${ Math.max( col2 - col, 0 ) })`;
			}
		}
	}
}

module.exports = CodeMirrorLint;
