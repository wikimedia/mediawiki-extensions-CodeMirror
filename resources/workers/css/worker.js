/* global stylelint */
const { rules } = require( 'stylelint-config-recommended' );
require( '@bhsd/stylelint-browserify/bundle/stylelint-es8.min.js' );

let customRules;

const getConfig = () => Object.assign( {}, rules, customRules );

self.onmessage = ( { data: [ command, code ] } ) => {
	switch ( command ) {
		case 'setConfig':
			customRules = code;
			break;
		case 'getConfig':
			postMessage( [ command, getConfig() ] );
			break;
		case 'lint':
			return stylelint.lint( {
				code,
				config: {
					defaultSeverity: 'warning',
					rules: getConfig()
				}
			} ).then( ( r ) => {
				postMessage( [
					command,
					r.results.map( ( { warnings } ) => warnings )
						.reduce( ( acc, cur ) => acc.concat( cur ), [] )
						.filter( ( { text } ) => !text.startsWith( 'Unknown rule ' ) ),
					code
				] );
			} );
	}
};
