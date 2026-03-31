const CodeMirrorValidator = require( '../../codemirror.validator.js' );

/**
 * AbuseFilter API-powered validator for CodeMirror.
 *
 * @extends CodeMirrorValidator
 */
class CodeMirrorAbuseFilterValidator extends CodeMirrorValidator {

	/** @inheritDoc */
	post( content ) {
		return this.api.post( {
			action: 'abusefilterchecksyntax',
			filter: content
		} ).then( ( r ) => r.abusefilterchecksyntax );
	}
}

module.exports = CodeMirrorAbuseFilterValidator;
