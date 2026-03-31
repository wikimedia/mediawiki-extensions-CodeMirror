const { Diagnostic } = require( 'ext.CodeMirror.v6.lib' );
const { abusefilterLanguage, abusefilter, analyzer } = require( '../lib/codemirror6.bundle.abusefilter.js' );
const CodeMirrorMode = require( './codemirror.mode.js' );

/**
 * Gets a API-powered AbuseFilter validator function.
 *
 * @param {mw.Api} api
 * @return {Function}
 * @private
 */
const getValidator = ( api ) => {
	let timeout,
		waiting,
		denied = false;
	const execute = async ( filter ) => {
		api.abort();
		if ( denied ) {
			return [];
		} else if ( timeout ) {
			waiting = filter;
			return timeout;
		}
		timeout = new Promise( ( resolve ) => {
			setTimeout( () => {
				timeout = undefined;
				if ( waiting === undefined ) {
					resolve( [] );
				} else {
					const text = waiting;
					waiting = undefined;
					resolve( execute( text ) );
				}
			}, 3000 );
		} );
		return filter ?
			api.post( {
				action: 'abusefilterchecksyntax',
				filter
			} ).then(
				( r ) => r.abusefilterchecksyntax,
				( msg, e ) => {
					if ( msg === 'permissiondenied' ) {
						denied = true;
					} else if ( typeof e !== 'object' || e.textStatus !== 'abort' ) {
						mw.log.warn(
							'[CodeMirror] API validation failed',
							typeof e === 'object' ? e.textStatus : e
						);
					}
					return [];
				}
			) :
			[];
	};
	return execute;
};

/**
 * Converts an API response into a CodeMirror diagnostic.
 *
 * @param {Object} obj
 * @param {string} severity
 * @return {Diagnostic}
 * @private
 */
const convertDiagnostic = ( obj, severity ) => ( {
	severity,
	source: 'AbuseFilter',
	message: obj.message,
	from: obj.character,
	to: obj.character
} );

/**
 * AbuseFilter language support for CodeMirror.
 *
 * @example
 * const require = await mw.loader.using( [
 *   'ext.CodeMirror.v6',
 *   'ext.CodeMirror.v6.abusefilter'
 * ] );
 * const CodeMirror = require( 'ext.CodeMirror.v6' );
 * const abusefilter = require( 'ext.CodeMirror.v6.abusefilter' );
 * const cm = new CodeMirror( myTextarea, abusefilter() );
 * cm.initialize();
 * @extends CodeMirrorMode
 * @hideconstructor
 */
class CodeMirrorAbuseFilter extends CodeMirrorMode {

	/** @inheritDoc */
	get language() {
		return abusefilterLanguage;
	}

	/** @inheritDoc */
	get lintSource() {
		return analyzer;
	}

	/** @inheritdoc */
	get lintApi() {
		const execute = getValidator( new mw.Api() );
		return async ( { state: { doc } } ) => {
			const result = await execute( doc.toString() );
			if ( result.status === 'error' ) {
				return [ convertDiagnostic( result, 'error' ) ];
			} else if ( result.warnings ) {
				return result.warnings.map( ( warning ) => convertDiagnostic( warning, 'warning' ) );
			}
			return [];
		};
	}

	/** @inheritDoc */
	get support() {
		const { deprecated, disabled, functions, keywords, variables } =
			mw.config.get( 'abuseFilterHighlighterConfig', mw.config.get( 'aceConfig' ) );
		return [
			abusefilter( {
				deprecated: deprecated.split( '|' ),
				disabled: disabled.split( '|' ),
				functions: functions.split( '|' ),
				keywords: keywords.split( '|' ),
				variables: variables.split( '|' )
			} ).support
		];
	}

	/** @inheritDoc */
	get hasWorker() {
		// AbuseFilter linting is done in the main thread.
		return false;
	}
}

module.exports = () => new CodeMirrorAbuseFilter( 'abusefilter' );
