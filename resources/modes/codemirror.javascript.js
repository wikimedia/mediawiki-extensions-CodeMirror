const { syntaxTree, Decoration } = require( 'ext.CodeMirror.lib' );
const {
	localCompletionSource,
	javascript,
	javascriptLanguage,
	scopeCompletionSource
} = require( '../lib/codemirror.bundle.modes.js' );
const CodeMirrorMode = require( './codemirror.mode.js' );
const { doctag, markDocTagType, getViewPlugin } = require( './codemirror.doctag.js' );
const CodeMirrorWorker = require( '../workers/codemirror.worker.js' );
const getCodeMirrorValidator = require( '../codemirror.validate.js' );

// Extracted from globals/globals.json (NPM)
const builtin = new Set( [
	'Array',
	'ArrayBuffer',
	'Atomics',
	'BigInt',
	'BigInt64Array',
	'BigUint64Array',
	'Boolean',
	'constructor',
	'DataView',
	'Date',
	'decodeURI',
	'decodeURIComponent',
	'encodeURI',
	'encodeURIComponent',
	'Error',
	'escape',
	'eval',
	'EvalError',
	'Float32Array',
	'Float64Array',
	'Function',
	'globalThis',
	'hasOwnProperty',
	'Infinity',
	'Int16Array',
	'Int32Array',
	'Int8Array',
	'isFinite',
	'isNaN',
	'isPrototypeOf',
	'JSON',
	'Map',
	'Math',
	'NaN',
	'Number',
	'Object',
	'parseFloat',
	'parseInt',
	'Promise',
	'propertyIsEnumerable',
	'Proxy',
	'RangeError',
	'ReferenceError',
	'Reflect',
	'RegExp',
	'Set',
	'SharedArrayBuffer',
	'String',
	'Symbol',
	'SyntaxError',
	'toLocaleString',
	'toString',
	'TypeError',
	'Uint16Array',
	'Uint32Array',
	'Uint8Array',
	'Uint8ClampedArray',
	'undefined',
	'unescape',
	'URIError',
	'valueOf',
	'WeakMap',
	'WeakSet'
] );

const globals = Decoration.mark( { class: 'cm-globals' } ),
	doctagName = Decoration.mark( { class: 'cm-doctag-var' } );

const markGlobals = ( tree, visibleRanges, state ) => {
	const decorations = [];
	for ( const { from, to } of visibleRanges ) {
		tree.iterate( {
			from,
			to,
			enter: ( { type, from: f, to: t } ) => {
				const name = state.sliceDoc( f, t );
				if ( type.is( 'VariableName' ) && builtin.has( name ) ) {
					// Exclude shadowed globals
					// However, this may be slow for large files with complex scopes
					const completions = localCompletionSource( { state, pos: t, explicit: true } );
					if (
						!completions ||
						!completions.options.some( ( { label } ) => label === name )
					) {
						decorations.push( globals.range( f, t ) );
					}
				} else if ( type.is( 'BlockComment' ) && /^\/\*{2}(?!\*)/.test( name ) ) {
					// JSDoc annotations
					const comment = name.slice( 2 ),
						pos = f + 2,
						re = /(^[ \t]*\*\s*)(@[a-z]+)(\s+\{)?|\{(@[a-z]+)/gim;
					let mt = re.exec( comment );
					while ( mt ) {
						if ( mt[ 4 ] ) {
							// Inline tag, e.g. {@link}
							decorations.push(
								doctag.range( pos + mt.index + 1, pos + mt.index + mt[ 0 ].length )
							);
						} else {
							const index = markDocTagType( decorations, pos, mt ),
								m = /(^\s+)([a-z_]\w*)\s+-/i.exec( comment.slice( index ) );
							if ( m ) {
								// JSDoc name annotation, e.g. @param {string} name - description
								const start = pos + index + m[ 1 ].length,
									end = start + m[ 2 ].length;
								decorations.push( doctagName.range( start, end ) );
							}
						}
						mt = re.exec( comment );
					}
				}
			}
		} );
	}
	return Decoration.set( decorations );
};

/**
 * JavaScript language support for CodeMirror.
 *
 * @example
 * const require = await mw.loader.using( [ 'ext.CodeMirror', 'ext.CodeMirror.modes' ] );
 * const CodeMirror = require( 'ext.CodeMirror' );
 * const { javascript } = require( 'ext.CodeMirror.modes' );
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
						...suggestions.map( ( suggestion ) => ( {
							name: suggestion.messageId || 'suggestion',
							fix: suggestion.fix,
							tooltip: suggestion.desc
						} ) )
					].map( ( { name, fix: { range: [ from, to ], text }, tooltip } ) => ( {
						name,
						tooltip,
						apply( v ) {
							v.dispatch( { changes: { from, to, insert: text } } );
						}
					} ) );
				}
				return diagnostic;
			} );
		};
	}

	/** @inheritdoc */
	get lintApi() {
		const execute = getCodeMirrorValidator(
			new mw.Api(),
			mw.config.get( 'wgPageName' ),
			'javascript'
		);
		return async ( { state: { doc } } ) => {
			const errors = await execute( doc.toString() );
			return errors.map( ( { message, line, column } ) => {
				const from = doc.line( line ).from + column;
				return {
					severity: 'error',
					source: 'Peast',
					message,
					from,
					to: from
				};
			} );
		};
	}

	/** @inheritDoc */
	get bracketMatchingConfig() {
		return {
			exclude( state, pos ) {
				return syntaxTree( state ).resolveInner( pos, 0 ).name === 'RegExp';
			}
		};
	}

	/** @inheritDoc */
	get support() {
		return [
			this.theme,
			javascript().support,
			javascriptLanguage.data.of( { autocomplete: scopeCompletionSource( window ) } ),
			getViewPlugin( markGlobals )
		];
	}
}

module.exports = CodeMirrorJavaScript;
