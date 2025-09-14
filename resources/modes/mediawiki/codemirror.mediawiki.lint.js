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
		'html-comment',
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
		'quotes',
		'remove',
		'table',
		'template-in-link',
		'unbalanced-in-section-header',
		'unclosed',
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
lintSource.worker = worker;

module.exports = lintSource;

if ( mw.config.get( 'cmDebug' ) ) {
	window.mediawikiWorker = worker;
}
