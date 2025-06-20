/* global luacheck */
const onmessage = require( '../common.js' );
require( 'luacheck-browserify/dist/es8.min.js' );

const Luacheck = luacheck();

const setConfig = () => {};
const getConfig = () => undefined;
const lint = async ( code ) => ( await Luacheck.queue( code ) )
	.filter( ( { severity } ) => severity );

onmessage( setConfig, getConfig, lint );
