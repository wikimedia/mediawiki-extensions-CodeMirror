const { jsonLanguage, jsonParseLinter } = require( '../lib/codemirror6.bundle.modes.js' );
const CodeMirrorMode = require( './codemirror.mode.js' );
const jsonLint = require( './json/codemirror.json.lint.js' );

/**
 * JSON language support for CodeMirror.
 *
 * @example
 * const require = await mw.loader.using( [ 'ext.CodeMirror.v6', 'ext.CodeMirror.v6.modes' ] );
 * const CodeMirror = require( 'ext.CodeMirror.v6' );
 * const { json } = require( 'ext.CodeMirror.v6.modes' );
 * const cm = new CodeMirror( myTextarea, json() );
 * cm.initialize();
 * @extends CodeMirrorMode
 * @hideconstructor
 */
class CodeMirrorJson extends CodeMirrorMode {

	/** @inheritDoc */
	get language() {
		return jsonLanguage;
	}

	/** @inheritDoc */
	get lintSource() {
		const jsonLintNative = jsonParseLinter();
		return ( view ) => {
			const str = view.state.doc.toString();
			// Skip empty documents.
			if ( !str.trim() ) {
				return [];
			}
			let errors;
			try {
				jsonLint( str );
			} catch ( e ) {
				if ( e instanceof Error ) {
					// If the custom JSON parser fails,
					// log failures and fall back to native `JSON.parse()`.
					mw.errorLogger.logError( e, 'error.codemirror' );
				} else {
					// Otherwise, collect errors and warnings from the custom parser.
					const { warnings } = e;
					// Has a real syntax error.
					if ( e.message ) {
						warnings.push( e );
					}
					errors = warnings.map( ( { message, severity, position } ) => ( {
						message,
						severity,
						from: position,
						to: position
					} ) );
					// If there is a real syntax error, return immediately.
					if ( e.message ) {
						return errors;
					}
				}
			}
			// Fall back to native `JSON.parse()` errors.
			const nativeErrors = jsonLintNative( view );
			return errors ? [ ...nativeErrors, ...errors ] : nativeErrors;
		};
	}

	/** @inheritDoc */
	get hasWorker() {
		// JSON linting is done in the main thread.
		return false;
	}
}

module.exports = CodeMirrorJson;
