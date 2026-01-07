/**
 * Gets a API-powered CodeMirror validator function.
 *
 * @param {mw.Api} api
 * @param {string} title
 * @param {string} contentmodel
 * @return {Function}
 * @private
 */
const getCodeMirrorValidator = ( api, title, contentmodel ) => {
	let timeout,
		waiting;
	const execute = async ( content ) => {
		api.abort();
		if ( timeout ) {
			waiting = content;
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
		return content ?
			api.post( {
				action: 'codemirror-validate',
				contentmodel,
				content,
				title,
				formatversion: 2
			} ).then(
				( r ) => r[ 'codemirror-validate' ].errors || [],
				( _, e ) => {
					if ( typeof e !== 'object' || e.textStatus !== 'abort' ) {
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

module.exports = getCodeMirrorValidator;
