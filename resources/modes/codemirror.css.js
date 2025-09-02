const { syntaxTree } = require( 'ext.CodeMirror.v6.lib' );
const { cssLanguage, cssCompletionSource } = require( '../lib/codemirror6.bundle.modes.js' );
const CodeMirrorMode = require( './codemirror.mode.js' );
const CodeMirrorWorker = require( '../workers/codemirror.worker.js' );

class CodeMirrorCss extends CodeMirrorMode {

	/** @inheritDoc */
	get language() {
		return cssLanguage;
	}

	/** @inheritDoc */
	get lintSource() {
		return async ( view ) => {
			const data = await this.worker.lint( view );
			return data.map( ( {
				text,
				severity,
				line,
				column,
				endLine,
				endColumn,
				rule,
				fix
			} ) => {
				const diagnostic = {
					rule,
					source: 'Stylelint',
					message: text,
					severity: severity === 'error' ? 'error' : 'info',
					from: CodeMirrorWorker.pos( view, line, column ),
					to: endLine === undefined ?
						view.state.doc.line( line ).to :
						CodeMirrorWorker.pos( view, endLine, endColumn )
				};
				if ( fix ) {
					const { range: [ from, to ], text: insert } = fix;
					diagnostic.actions = [
						{
							name: 'fix',
							apply( v ) {
								v.dispatch( { changes: { from, to, insert } } );
							}
						}
					];
				}
				return diagnostic;
			} );
		};
	}

	/** @inheritDoc */
	get support() {
		return cssLanguage.data.of( {
			autocomplete( context ) {
				const { state, pos: p } = context,
					node = syntaxTree( state ).resolveInner( p, -1 ),
					result = cssCompletionSource( context );
				if ( result && node.name === 'ValueName' ) {
					const options = [ { label: 'revert', type: 'keyword' }, ...result.options ];
					let { prevSibling } = node;
					while ( prevSibling && prevSibling.name !== 'PropertyName' ) {
						( { prevSibling } = prevSibling );
					}
					if ( prevSibling ) {
						for ( let i = 0; i < options.length; i++ ) {
							const option = options[ i ];
							if ( CSS.supports(
								state.sliceDoc( prevSibling.from, node.from ) + option.label
							) ) {
								options.splice( i, 1, Object.assign( {}, option, { boost: 50 } ) );
							}
						}
					}
					result.options = options;
				}
				return result;
			}
		} );
	}
}

module.exports = CodeMirrorCss;
