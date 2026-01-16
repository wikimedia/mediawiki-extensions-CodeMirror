/* eslint-disable camelcase */
/* global luacheck */
const onmessage = require( '../common.js' );
require( 'luacheck-browserify/dist/es8.min.js' );

// Disable line length checks unless explicitly overridden
const options = {
	std: 'mediawiki',
	max_line_length: false,
	max_code_line_length: false,
	max_string_line_length: false,
	max_comment_line_length: false
};
let config = options,
	Luacheck = luacheck( config );

const setConfig = ( newConfig ) => {
	if ( typeof newConfig === 'string' ) {
		config = Object.assign( {}, options, { std: newConfig } );
	} else {
		config = Object.assign( {}, options, newConfig );
	}
	Luacheck = luacheck( config );
};
const getConfig = () => config;
const lint = async ( code ) => ( await Luacheck.queue( code ) )
	.filter( ( { severity } ) => severity );

onmessage( setConfig, getConfig, lint );
