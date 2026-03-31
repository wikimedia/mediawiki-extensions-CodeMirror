/**
 * API-powered CodeMirror validator.
 */
class CodeMirrorValidator {

	/**
	 * @constructor
	 * @param {string} [contentmodel]
	 * @internal
	 * @hideconstructor
	 */
	constructor( contentmodel ) {
		/** @type {mw.Api} */
		this.api = new mw.Api();

		/**
		 * The title of the page being edited, used for context in validation.
		 *
		 * @type {string}
		 */
		this.title = mw.config.get( 'wgPageName' );

		/**
		 * The content model of the page being edited, used for context in validation.
		 *
		 * @type {string}
		 */
		this.contentmodel = contentmodel;

		/**
		 * Whether the user is denied permission to access the validation API.
		 *
		 * @type {boolean}
		 */
		this.denied = false;
	}

	/**
	 * Posts content to the API and returns a promise that resolves with diagnostics.
	 *
	 * @param {string} content
	 * @return {Promise}
	 * @protected
	 * @internal
	 */
	post( content ) {
		return this.api.post( {
			action: 'codemirror-validate',
			contentmodel: this.contentmodel,
			content,
			title: this.title,
			formatversion: 2
		} ).then( ( r ) => ( r[ 'codemirror-validate' ] || {} ).errors || [] );
	}

	/**
	 * Get diagnostics for the given content.
	 *
	 * @param {string} content
	 * @return {Promise}
	 */
	async execute( content ) {
		this.api.abort();
		if ( this.denied ) {
			return [];
		} else if ( this.timeout ) {
			this.waiting = content;
			return this.timeout;
		}
		this.timeout = new Promise( ( resolve ) => {
			setTimeout( () => {
				this.timeout = undefined;
				if ( this.waiting === undefined ) {
					resolve( [] );
				} else {
					const text = this.waiting;
					this.waiting = undefined;
					resolve( this.execute( text ) );
				}
			}, 3000 );
		} );
		return content ?
			this.post( content ).catch( ( msg, e ) => {
				if ( msg === 'permissiondenied' ) {
					this.denied = true;
				} else if ( typeof e !== 'object' || e.textStatus !== 'abort' ) {
					mw.log.warn(
						'[CodeMirror] API validation failed',
						typeof e === 'object' ? e.textStatus : e
					);
				}
				return [];
			} ) :
			[];
	}
}

module.exports = CodeMirrorValidator;
