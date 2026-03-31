const CodeMirrorValidator = require( '../../codemirror.validator.js' );

/**
 * Parsoid validator for CodeMirror.
 *
 * @extends CodeMirrorValidator
 */
class CodeMirrorMediaWikiValidator extends CodeMirrorValidator {

	/** @inheritdoc */
	constructor() {
		super();
		this.api = new mw.Rest();
	}

	/** @inheritDoc */
	post( wikitext ) {
		return this.api.post(
			`/v1/transform/wikitext/to/lint/${ encodeURIComponent( this.title ) }`,
			{ wikitext }
		);
	}
}

module.exports = CodeMirrorMediaWikiValidator;
