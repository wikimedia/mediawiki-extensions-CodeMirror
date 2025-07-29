const CodeMirrorWorker = require( '../../codemirror.worker.js' );

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
	await new mw.Api().loadMessagesIfMissing( [
		'attributes-of-closing-tag',
		'comment',
		'conflicting-image-parameter',
		'delink',
		'duplicate-attribute',
		'duplicate-image-parameter',
		'duplicate-parameter',
		'escape',
		'ext-in-html',
		'frame',
		'header-in-html',
		'horizontal-alignment',
		'html-in-table',
		'imagemap-without-image',
		'illegal-attribute-name',
		'illegal-attribute-value',
		'illegal-module',
		'invalid-attribute',
		'invalid-content',
		'invalid-conversion-flag',
		'invalid-gallery',
		'invalid-imagemap-link',
		'invalid-isbn',
		'invalid-parameter',
		'invisible-triple-braces',
		'link-in-extlink',
		'lonely',
		'missing-function',
		'newline',
		'nonzero-tabindex',
		'nothing-in',
		'open',
		'prefix',
		'pipe-in-table',
		'remove',
		'unbalanced-in-section-header',
		'unescaped-query',
		'uppercase',
		'useless-attribute',
		'vertical-alignment'
	].map( ( key ) => `codemirror-wikilint-${ key }` ) );
	worker.setI18N( mw.messages.values );
} );

const lintSource = ( view ) => worker.lint( view ).then( ( data ) => data
	.map( ( { startIndex, endIndex, rule, message, fix, suggestions } ) => ( {
		rule,
		source: 'WikiLint',
		message: `${ message } (${ rule })`,
		severity: 'info',
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
lintSource.worker = worker;

module.exports = lintSource;

if ( mw.config.get( 'cmDebug' ) ) {
	window.mediawikiWorker = worker;
}
