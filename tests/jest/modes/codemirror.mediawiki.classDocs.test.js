const { CodeMirrorMediaWiki } = require( '../../../resources/modes/mediawiki/codemirror.mediawiki.js' );
const mwModeConfig = require( '../../../resources/modes/mediawiki/codemirror.mediawiki.config.js' );
const CodeMirrorExtensionRegistry = require( '../../../resources/codemirror.extensionRegistry.js' );
const CodeMirrorKeymap = require( '../../../resources/codemirror.keymap.js' );
const CodeMirrorPreferences = require( '../../../resources/codemirror.preferences.js' );
const CodeMirrorThemes = require( '../../../resources/themes/codemirror.themes.js' );
const { matchMarks, render } = require( '../../../docs-src/render.js' );
const docs = require( '../../../docs-src/classes.json' );
const mwConfig = require( '../../../docs-src/mwConfig.js' );

// getTagStyles() reads a module singleton that every CodeMirrorMediaWiki constructor mutates,
// so this file builds the mode itself and must not share a process with a different config.
const mode = new CodeMirrorMediaWiki( mwConfig );
const emitted = [ ...new Set(
	mwModeConfig.getTagStyles( mode.getParser() )
		.flatMap( ( spec ) => spec.class.split( ' ' ) )
) ];

const rowsOf = ( section ) => section.rows || [];
const documented = new Set(
	docs.sections.filter( ( section ) => !section.fromExtensions )
		.flatMap( rowsOf )
		.flatMap( ( row ) => row.classes )
);
const patterns = docs.sections
	.flatMap( ( section ) => ( section.patterns || [] ) )
	// eslint-disable-next-line security/detect-non-literal-regexp
	.map( ( pattern ) => new RegExp( pattern ) );
const grounded = docs.sections.some( ( section ) => section.grounds );

describe( 'Wikitext style reference', () => {
	it( 'documents every class the mode emits', () => {
		const missing = emitted.filter( ( name ) => !documented.has( name ) &&
			!( grounded && name.endsWith( '-ground' ) ) &&
			!patterns.some( ( pattern ) => pattern.test( name ) ) &&
			!( name in docs.undocumented )
		);
		expect( missing ).toEqual( [] );
	} );

	it( 'does not document classes the mode never emits', () => {
		const stale = [ ...documented ].filter( ( name ) => !emitted.includes( name ) );
		expect( stale ).toEqual( [] );
	} );

	it( 'offers the themes the mode offers', () => {
		const themes = new CodeMirrorThemes( new CodeMirrorPreferences(
			new CodeMirrorExtensionRegistry( {} ), 'mediawiki', new CodeMirrorKeymap()
		) );
		// getOptions() lists each theme twice, once per light/dark variant; the form spec
		// puts them in a Map, which is what the reader sees.
		expect( docs.themes ).toEqual( [ ...new Map( themes.getOptions() ).values() ] );
	} );

	it( 'gives every row a description and an example', () => {
		const rows = docs.sections.flatMap( rowsOf );
		expect( rows.filter( ( row ) => !row.description || !row.wikitext ) ).toEqual( [] );
	} );

	it( 'shows every class its examples name', () => {
		const wrong = [];
		for ( const row of docs.sections.flatMap( rowsOf ) ) {
			const html = render( mode, row.wikitext,
				row.cursor ? matchMarks( mode, row.wikitext, row.cursor ) : [] );
			const shown = new Set( [ ...html.matchAll( /class="([^"]+)"/g ) ]
				.flatMap( ( match ) => match[ 1 ].split( ' ' ) ) );
			wrong.push( ...row.classes.filter( ( name ) => !shown.has( name ) )
				.map( ( name ) => `${ name }: ${ row.wikitext }` ) );
		}
		expect( wrong ).toEqual( [] );
	} );

	it( 'places the caret inside every matching example', () => {
		const rows = docs.sections.filter( ( section ) => section.fromExtensions )
			.flatMap( rowsOf );
		expect( rows.filter( ( row ) => !row.cursor || !row.wikitext.includes( row.cursor ) ) )
			.toEqual( [] );
	} );
} );
