const { javascript, javascriptLanguage, scopeCompletionSource } = require( '../lib/codemirror6.bundle.modes.js' );
const CodeMirrorMode = require( './codemirror.mode.js' );
const CodeMirrorWorker = require( '../workers/codemirror.worker.js' );

/**
 * JavaScript language support for CodeMirror.
 *
 * @example
 * const require = await mw.loader.using( [ 'ext.CodeMirror.v6', 'ext.CodeMirror.v6.modes' ] );
 * const CodeMirror = require( 'ext.CodeMirror.v6' );
 * const { javascript } = require( 'ext.CodeMirror.v6.modes' );
 * const cm = new CodeMirror( myTextarea, javascript() );
 * cm.initialize();
 * @extends CodeMirrorMode
 * @hideconstructor
 */
class CodeMirrorJavaScript extends CodeMirrorMode {

	/** @inheritDoc */
	get language() {
		return javascriptLanguage;
	}

	/** @inheritDoc */
	get lintSource() {
		return async ( view ) => {
			const data = await this.worker.lint( view );
			return data.map( ( {
				ruleId,
				message,
				severity,
				line,
				column,
				endLine,
				endColumn,
				fix,
				suggestions = []
			} ) => {
				const start = CodeMirrorWorker.pos( view, line, column );
				const diagnostic = {
					rule: ruleId,
					source: 'ESLint',
					message: message + ( ruleId ? ` (${ ruleId })` : '' ),
					severity: severity === 1 ? 'info' : 'error',
					from: start,
					to: endLine === undefined ?
						start + 1 :
						CodeMirrorWorker.pos( view, endLine, endColumn )
				};
				if ( fix || suggestions.length ) {
					diagnostic.actions = [
						...fix ? [ { name: 'fix', fix } ] : [],
						...suggestions.map( ( suggestion ) => ( { name: 'suggestion', fix: suggestion.fix } ) )
					].map( ( { name, fix: { range: [ from, to ], text } } ) => ( {
						name,
						apply( v ) {
							v.dispatch( { changes: { from, to, insert: text } } );
						}
					} ) );
				}
				return diagnostic;
			} );
		};
	}

	/** @inheritDoc */
	get support() {
		return [
			javascript().support,
			javascriptLanguage.data.of( { autocomplete: scopeCompletionSource( window ) } )
		];
	}
}

module.exports = CodeMirrorJavaScript;
