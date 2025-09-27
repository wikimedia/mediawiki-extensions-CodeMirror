const CodeMirrorWorker = require( '../../workers/codemirror.worker.js' );

const worker = new CodeMirrorWorker( 'mediawiki' );

worker.onload( async () => {
	const {
		tags,
		doubleUnderscore,
		urlProtocols,
		functionSynonyms,
		variableIDs,
		functionHooks,
		redirection,
		imageKeywords
	} = mw.config.get( 'extCodeMirrorConfig' );
	const insensitive = Object.assign( {}, functionSynonyms[ 0 ] ),
		[ , sensitive ] = functionSynonyms,
		behaviorSwitch = doubleUnderscore
			.map( ( obj, i ) => Object.entries( obj ).map( ( [ k, v ] ) => [
				k.slice( 2, -2 ),
				i && typeof v === 'string' ? v.toUpperCase() : v
			] ) );
	for ( const [ k, v ] of Object.entries( insensitive ) ) {
		if ( k in sensitive ) {
			delete insensitive[ k ];
		} else {
			insensitive[ k ] = v.toLowerCase();
		}
	}
	const config = {
		ext: Object.keys( tags ),
		namespaces: mw.config.get( 'wgFormattedNamespaces' ),
		nsid: mw.config.get( 'wgNamespaceIds' ),
		functionHook: functionHooks,
		variable: variableIDs,
		parserFunction: [ insensitive, sensitive, [], [] ],
		doubleUnderscore: [
			[],
			[],
			...behaviorSwitch.map( ( entries ) => {
				const obj = {};
				for ( const [ k, v ] of entries ) {
					obj[ k ] = v;
				}
				return obj;
			} )
		],
		protocol: urlProtocols.replace( /\|\\?\/\\?\/$|\\(?=[:/])/g, '' ),
		img: imageKeywords,
		redirection,
		variants: mw.config.get( 'cmLanguageVariants' ) || []
	};
	worker.setConfig( config );
	const messages = [
		'attributes-of-closing-tag',
		'bold-apostrophes',
		'bold-in-header',
		'close',
		'comment',
		'conflicting-image-parameter',
		'content-outside-table',
		'decode',
		'delink',
		'duplicate-attribute',
		'duplicate-category',
		'duplicate-id',
		'duplicate-image-parameter',
		'duplicate-parameter',
		'encode',
		'escape',
		'ext-in-html',
		'frame',
		'full-width-punctuation',
		'header-in-html',
		'horizontal-alignment',
		'html-in-table',
		'illegal-attribute-name',
		'illegal-attribute-value',
		'illegal-module',
		'imagemap-without-image',
		'in-url',
		'inconsistent-table',
		'invalid-attribute',
		'invalid-content',
		'invalid-conversion-flag',
		'invalid-gallery',
		'invalid-image-parameter',
		'invalid-imagemap-link',
		'invalid-isbn',
		'invalid-parameter',
		'invisible-triple-braces',
		'italic-apostrophes',
		'left-bracket',
		'link-in-extlink',
		'lonely',
		'missing-extension',
		'missing-function',
		'newline',
		'nonzero-tabindex',
		'nothing-in',
		'obsolete-attribute',
		'obsolete-tag',
		'open',
		'prefix',
		'pipe-in-link',
		'pipe-in-table',
		'remove',
		'template-in-link',
		'unbalanced-in-section-header',
		'unclosed',
		'unclosed-comment',
		'unclosed-quotes',
		'unclosed-table',
		'unescaped-query',
		'unnecessary-encoding',
		'uppercase',
		'useless-attribute',
		'useless-fragment',
		'useless-link-text',
		'variable-anchor',
		'vertical-alignment',
		'whitespace'
	].map( ( key ) => `codemirror-wikilint-${ key }` );
	await new mw.Api().loadMessagesIfMissing( messages );
	worker.setI18N( mw.messages.get( messages ) );
} );

const lintSource = ( view ) => worker.lint( view ).then( ( data ) => data
	.map( ( { startIndex, endIndex, rule, message, severity, fix, suggestions } ) => ( {
		rule,
		source: 'WikiLint',
		message: `${ message } (${ rule })`,
		severity,
		from: startIndex,
		to: endIndex,
		actions: [
			...fix ? [ fix ] : [],
			...suggestions || []
		].map( ( { desc, range, text } ) => ( {
			name: desc,
			apply( v ) {
				v.dispatch( {
					changes: {
						from: range[ 0 ],
						to: range[ 1 ],
						insert: text
					}
				} );
			}
		} ) )
	} ) )
);

const getMsgKey = ( type ) => `linter-category-${ type }`;

const api = new mw.Api(),
	rest = new mw.Rest(),
	hasExtLinter = mw.loader.getState( 'ext.linter.edit' ) !== null;
let timeout, waiting;

const execute = async ( wikitext ) => {
	rest.abort();
	if ( timeout ) {
		waiting = wikitext;
		return timeout;
	}
	timeout = new Promise( ( resolve ) => {
		setTimeout( () => {
			timeout = undefined;
			if ( waiting === undefined ) {
				resolve();
			} else {
				const text = waiting;
				waiting = undefined;
				resolve( execute( text ) );
			}
		}, 3000 );
	} );
	// This endpoint is still experimental and may change in the future.
	return rest.post( '/v1/transform/wikitext/to/lint', { wikitext } ).then(
		( errors ) => errors,
		( _, e ) => {
			if ( e.textStatus !== 'abort' ) {
				mw.log.warn( `[CodeMirror] Parsoid linting failed: ${ e.textStatus }.` );
			}
			return [];
		}
	);
};

const lintApi = async ( { state: { doc } } ) => {
	const errors = await execute( doc.toString() );
	if ( hasExtLinter && errors.length ) {
		await api.loadMessagesIfMissing( errors.map( ( { type } ) => getMsgKey( type ) ) );
	}
	return errors.map( ( { type, dsr: [ from, to ] } ) => {
		const msgKey = getMsgKey( type );
		return {
			severity: 'info',
			source: 'Parsoid',
			// eslint-disable-next-line mediawiki/msg-doc
			message: mw.messages.exists( msgKey ) ? mw.msg( msgKey ) : type,
			from,
			to
		};
	} );
};

module.exports = {
	lintSource,
	lintApi,
	worker
};

if ( mw.config.get( 'cmDebug' ) ) {
	window.mediawikiWorker = worker;
}
