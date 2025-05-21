/* global stylelint */
const { rules } = require( 'stylelint-config-recommended' );
require( '@bhsd/stylelint-browserify/bundle/stylelint-es7.min.js' );

self.onmessage = ( { data } ) => stylelint.lint( {
	code: data,
	config: {
		defaultSeverity: 'warning',
		rules
	}
} ).then( ( r ) => {
	postMessage( [
		r.results.map( ( { warnings } ) => warnings )
			.reduce( ( acc, cur ) => acc.concat( cur ), [] )
			.filter( ( { text } ) => !text.startsWith( 'Unknown rule ' ) ),
		data
	] );
} );
