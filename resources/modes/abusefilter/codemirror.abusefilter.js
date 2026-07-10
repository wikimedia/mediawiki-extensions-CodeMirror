const { Diagnostic, Text } = require( 'ext.CodeMirror.lib' );
const { abusefilterLanguage, abusefilter } = require( '../../lib/codemirror.bundle.abusefilter.js' );
const CodeMirrorMode = require( '../codemirror.mode.js' );
const CodeMirrorAbuseFilterValidator = require( './codemirror.abusefilter.validator.js' );

/**
 * Converts an API response into a CodeMirror diagnostic.
 *
 * @param {Object} obj
 * @param {string} severity
 * @param {Text} doc
 * @return {Diagnostic}
 * @private
 */
const convertDiagnostic = ( obj, severity, doc ) => {
	const pos = Math.min( obj.character, doc.length );
	return {
		severity,
		source: 'AbuseFilter',
		message: obj.message,
		from: pos,
		to: pos
	};
};

/**
 * AbuseFilter language support for CodeMirror.
 *
 * @example
 * const require = await mw.loader.using( [
 *   'ext.CodeMirror',
 *   'ext.CodeMirror.abusefilter'
 * ] );
 * const CodeMirror = require( 'ext.CodeMirror' );
 * const abusefilter = require( 'ext.CodeMirror.abusefilter' );
 * const cm = new CodeMirror( myTextarea, abusefilter() );
 * cm.initialize();
 * @extends CodeMirrorMode
 * @hideconstructor
 */
class CodeMirrorAbuseFilter extends CodeMirrorMode {

	/**
	 * @param {string} name
	 * @internal
	 * @hideconstructor
	 */
	constructor( name ) {
		super( name );

		/**
		 * The API-powered validator.
		 *
		 * @type {CodeMirrorAbuseFilterValidator}
		 */
		this.validator = new CodeMirrorAbuseFilterValidator();
	}

	/** @inheritDoc */
	get language() {
		return abusefilterLanguage;
	}

	/** @inheritdoc */
	get lintApi() {
		return async ( { state: { doc } } ) => {
			const result = await this.validator.execute( doc.toString() );
			if ( result.status === 'error' ) {
				return [ convertDiagnostic( result, 'error', doc ) ];
			} else if ( result.warnings ) {
				return result.warnings.map( ( warning ) => convertDiagnostic( warning, 'warning', doc ) );
			}
			return [];
		};
	}

	/** @inheritDoc */
	get support() {
		const { deprecated, disabled, functions, keywords, variables, dropdownOptions } =
			mw.config.get( 'abuseFilterHighlighterConfig', mw.config.get( 'aceConfig' ) );
		const hoverInfo = new Map();
		for ( const category in dropdownOptions ) {
			const words = dropdownOptions[ category ];
			for ( const desc in words ) {
				const word = /^\w*/.exec( words[ desc ] )[ 0 ];
				if ( word ) {
					hoverInfo.set( word, desc );
				}
			}
		}
		return [
			abusefilter( {
				deprecated: deprecated.split( '|' ),
				disabled: disabled.split( '|' ),
				functions: functions.split( '|' ),
				keywords: keywords.split( '|' ),
				variables: variables.split( '|' ),
				hoverInfo
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
