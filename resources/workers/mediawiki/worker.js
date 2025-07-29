/* global Parser */
const onmessage = require( '../common.js' );
require( 'wikiparser-node/bundle/bundle-es8.min.js' );

Parser.lintConfig = {
	'bold-header': 0,
	'format-leakage': 0,
	'fostered-content': 0,
	h1: 0,
	'insecure-style': 0,
	'lonely-apos': 0,
	'lonely-bracket': [
		0,
		{
			extLink: 2
		}
	],
	'lonely-http': 0,
	'no-arg': 0,
	'obsolete-attr': 0,
	'obsolete-tag': 0,
	'pipe-like': [
		0,
		{
			double: 2
		}
	],
	'table-layout': 0,
	'unclosed-comment': 0,
	'unclosed-quote': 0,
	'unclosed-table': 0,
	'unknown-page': 0,
	'unmatched-tag': 0,
	'unterminated-url': 0,
	'url-encoding': 0,
	'var-anchor': 0
};

const last = {};

const setConfig = ( config ) => {
	Parser.config = config;
};
const getConfig = () => Parser.getConfig();
const setI18N = ( i18n ) => {
	const obj = {};
	for ( const key in i18n ) {
		if ( key.startsWith( 'codemirror-wikilint-' ) ) {
			obj[ key.slice( 20 ) ] = i18n[ key ];
		}
	}
	Parser.i18n = obj;
};
const getI18N = () => Parser.i18n;
const lint = ( wikitext ) => {
	if ( last.wikitext === wikitext ) {
		return last.errors;
	}
	const errors = Parser.parse( wikitext ).lint()
		.filter( ( { severity } ) => severity === 'error' );
	last.wikitext = wikitext;
	last.errors = errors;
	return errors;
};

onmessage( setConfig, getConfig, lint, setI18N, getI18N );
