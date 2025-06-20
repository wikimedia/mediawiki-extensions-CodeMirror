/* global stylelint */
const { rules } = require( 'stylelint-config-recommended' );
const onmessage = require( '../common.js' );
require( '@bhsd/stylelint-browserify/bundle/stylelint-es8.min.js' );

let customRules = rules;

const setConfig = ( config ) => {
	customRules = Object.assign( {}, rules, config );
};
const getConfig = () => customRules;
const lint = ( code ) => stylelint.lint( {
	code,
	config: {
		defaultSeverity: 'warning',
		rules: customRules,
		computeEditInfo: true
	}
} ).then( ( { results } ) => results[ 0 ].warnings
	.filter( ( { text } ) => !text.startsWith( 'Unknown rule ' ) ) );

onmessage( setConfig, getConfig, lint );
