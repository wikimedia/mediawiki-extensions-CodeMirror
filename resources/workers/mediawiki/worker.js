/* global Parser */
const onmessage = require( '../common.js' );
require( 'wikiparser-node/bundle/bundle-es8.min.js' );

// Rules to be treated as "info" severity in CodeMirrorLint.
const infoRules = [
	'bold-header',
	'format-leakage',
	'table-layout',
	'unknown-page',
	'unclosed-table',
	'unterminated-url',
	'var-anchor'
];

Parser.lintConfig = {
	'fostered-content': [
		1,
		{ transclusion: 0 }
	],
	h1: 1,
	'illegal-attr': [
		2,
		{
			tabindex: 1,
			unknown: 2,
			value: 2
		}
	],
	'insecure-style': 0,
	'lonely-apos': [
		1,
		{
			word: 0
		}
	],
	'lonely-bracket': [
		1,
		{
			extLink: 2,
			single: 0
		}
	],
	'lonely-http': 0,
	'no-arg': 0,
	'no-duplicate': [
		2,
		{
			category: 1,
			id: 1,
			unknownImageParameter: 0
		}
	],
	'unmatched-tag': 0
};

// HACK: Customize severity of some rules to "info" which is not supported by wikiparser-node.
for ( const rule of infoRules ) {
	Parser.lintConfig[ rule ] = 1;
}

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
const setLintConfig = ( config ) => {
	Parser.lintConfig = config;
};
const lint = ( wikitext ) => {
	if ( last.wikitext === wikitext ) {
		return last.diagnostics;
	}
	const diagnostics = Parser.parse( wikitext ).lint()
		.map( ( diag ) => {
			if ( infoRules.includes( diag.rule ) ) {
				diag.severity = 'info';
			}
			return diag;
		} );
	last.wikitext = wikitext;
	last.diagnostics = diagnostics;
	return diagnostics;
};

onmessage( setConfig, getConfig, lint, setI18N, getI18N, setLintConfig );
