const {
	keymap,
	linter,
	lintGutter,
	nextDiagnostic,
	setDiagnosticsEffect,
	showPanel
} = require( 'ext.CodeMirror.v6.lib' );
const CodeMirrorPanel = require( './codemirror.panel.js' );

const renderDiagnostic = ( diagnostic ) => Object.assign( {
	renderMessage( view ) {
		const span = document.createElement( 'span' );
		span.className = 'cm-diagnosticText-clickable';
		span.textContent = diagnostic.message;
		span.addEventListener( 'click', () => {
			view.dispatch( {
				selection: { anchor: diagnostic.from, head: diagnostic.to }
			} );
		} );
		return span;
	}
}, diagnostic );

class CodeMirrorLint extends CodeMirrorPanel {
	constructor( lintSource, codemirrorKeymap, lintApi, gotoLine ) {
		super();
		this.lintSource = lintSource;
		this.lintApi = lintApi;
		this.keymap = codemirrorKeymap;
		this.gotoLine = gotoLine;
		this.diagnostics = [];
	}

	get extension() {
		if ( !this.lintSource ) {
			return [];
		}
		this.keymap.registerKeyBindingHelp( 'lint', 'next-diagnostic', { key: 'F8' } );
		const extension = [
			linter( async ( view ) => ( await this.lintSource( view ) ).map( renderDiagnostic ) ),
			lintGutter(),
			keymap.of( [ { key: 'F8', run: nextDiagnostic } ] ),
			showPanel.of( ( view ) => {
				this.view = view;
				return this.panel;
			} )
		];
		if ( this.lintApi ) {
			extension.push(
				linter( async ( view ) => ( await this.lintApi( view ) ).map( renderDiagnostic ) )
			);
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
		position.textContent = '0:0';
		position.addEventListener( 'click', () => this.gotoLine.openPanel( this.view ) );
		dom.append( worker, message, position );
		return {
			dom,
			update: ( update ) => {
				const { anchor, head } = update.state.selection.main;
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
					const line = update.state.doc.lineAt( head ),
						col = head - line.from;
					position.textContent = `${ line.number }:${ col }`;
					if ( anchor !== head ) {
						const line2 = update.state.doc.lineAt( anchor ),
							col2 = anchor - line2.from;
						if ( anchor < head ) {
							position.textContent += `|(${ line.number - line2.number }:${ Math.max( col - col2, 0 ) })`;
						} else {
							position.textContent += `|(${ line2.number - line.number }:${ Math.max( col2 - col, 0 ) })`;
						}
					}
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
			message.textContent = diagnostic.message;
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
}

module.exports = CodeMirrorLint;
