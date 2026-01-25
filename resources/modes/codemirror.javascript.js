const { syntaxTree, Decoration, ViewPlugin } = require( 'ext.CodeMirror.v6.lib' );
const {
	localCompletionSource,
	javascript,
	javascriptLanguage,
	scopeCompletionSource
} = require( '../lib/codemirror6.bundle.modes.js' );
const CodeMirrorMode = require( './codemirror.mode.js' );
const CodeMirrorWorker = require( '../workers/codemirror.worker.js' );

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

const globals = Decoration.mark( { class: 'cm-globals' } );

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

	/** @inheritDoc */
	get support() {
		return [
			javascript().support,
			javascriptLanguage.data.of( { autocomplete: scopeCompletionSource( window ) } ),
			ViewPlugin.fromClass( class {
				constructor( { state, visibleRanges } ) {
					this.tree = syntaxTree( state );
					this.decorations = markGlobals( this.tree, visibleRanges, state );
				}

				update( { docChanged, viewportChanged, state, view: { visibleRanges } } ) {
					const tree = syntaxTree( state );
					if ( docChanged || viewportChanged || tree !== this.tree ) {
						this.tree = tree;
						this.decorations = markGlobals( tree, visibleRanges, state );
					}
				}
			}, {
				decorations: ( v ) => v.decorations
			} )
		];
	}
}

module.exports = CodeMirrorJavaScript;
