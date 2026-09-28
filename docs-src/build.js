'use strict';

/**
 * Builds the wikitext style reference published at
 * https://doc.wikimedia.org/CodeMirror/master/js/wikitext-styles/
 *
 * Run by `npm run doc`. Writes to docs/, which is gitignored and rsynced to
 * doc.wikimedia.org/CodeMirror/<branch>/js/ by the mwext docs-publish CI job. The landing page
 * written beside it is docs-src/home.html.
 */

const esbuild = require( 'esbuild' );
const fs = require( 'fs' );
const { JSDOM } = require( 'jsdom' );
const less = require( 'less' );
const Module = require( 'module' );
const path = require( 'path' );

const ROOT = path.join( __dirname, '..' );
const DOC_DIR = path.join( ROOT, 'docs' );
const OUT_DIR = path.join( DOC_DIR, 'wikitext-styles' );
const LIB = path.join( ROOT, 'resources', 'codemirror.bundle.lib.js' );

// Production compiles this Less with wikimedia/less.php. This build uses less.js, so keep the
// style sheets free of anything the two implement differently.
const LESS_FILES = [
	'docs-src/less/tokens.less',
	'docs-src/less/editor-styles.less',
	'resources/visualEditor/codemirror.visualEditorHighlight.less'
];

/**
 * The mode reads the DOM and the MediaWiki globals while it loads, and asks for the library by
 * its ResourceLoader module name.
 *
 * @return {CodeMirrorMediaWiki}
 */
function loadMode() {
	const { window } = new JSDOM( '<!doctype html><html lang="en"><body></body></html>' );
	globalThis.window = window;
	globalThis.document = window.document;
	require( './stubs.js' );
	// stubs.js writes to `window`, which in a browser is the global object but here is not.
	globalThis.mw = window.mw;
	globalThis.$ = window.$;

	/* eslint-disable no-underscore-dangle */
	const resolveFilename = Module._resolveFilename;
	Module._resolveFilename = function ( request, ...args ) {
		return request === 'ext.CodeMirror.lib' ?
			path.join( ROOT, 'resources', 'lib', 'codemirror.bundle.lib.js' ) :
			resolveFilename.call( this, request, ...args );
	};
	/* eslint-enable no-underscore-dangle */

	const {
		CodeMirrorMediaWiki
	} = require( '../resources/modes/mediawiki/codemirror.mediawiki.js' );
	return new CodeMirrorMediaWiki( require( './mwConfig.js' ) );
}

/**
 * @param {string} file Path relative to the repository root.
 * @return {Promise<string>}
 */
async function renderLess( file ) {
	const filename = path.join( ROOT, file );
	// eslint-disable-next-line security/detect-non-literal-fs-filename
	const { css } = await less.render( fs.readFileSync( filename, 'utf8' ), {
		filename,
		// docs-src/less stands in for the import ResourceLoader supplies; node_modules resolves
		// the Codex tokens that shim pulls in.
		paths: [ path.join( ROOT, 'docs-src', 'less' ), path.join( ROOT, 'node_modules' ) ]
	} );
	return `/* ${ file } */\n${ css }`;
}

/**
 * @return {Promise<string>} The playground editor and the page's controls.
 */
async function bundleDemo() {
	const result = await esbuild.build( {
		entryPoints: [ path.join( __dirname, 'demo.js' ) ],
		bundle: true,
		charset: 'utf8',
		format: 'iife',
		minify: true,
		target: 'es2019',
		write: false,
		plugins: [ {
			name: 'ext-codemirror-lib',
			setup( build ) {
				// Resolve the ResourceLoader module name to the Rollup entry point rather than
				// its built output, so esbuild can tree-shake. A relative alias would be
				// resolved against each importing file, so it has to be a plugin.
				build.onResolve( { filter: /^ext\.CodeMirror\.lib$/ }, () => ( { path: LIB } ) );
			}
		} ]
	} );
	return result.outputFiles[ 0 ].text;
}

/**
 * The labels come from the extension's own messages, so the selector names each theme the way
 * the editor's settings do.
 *
 * @param {Array<string>} themes
 * @return {string}
 */
function buildThemeOptions( themes ) {
	const { escapeHtml } = require( './render.js' );
	const messages = require( '../i18n/en.json' );
	return themes.map( ( name ) => `<option value="${ name }">` +
		`${ escapeHtml( messages[ `codemirror-theme-${ name }` ] ) }</option>` ).join( '' );
}

/**
 * @param {CodeMirrorMediaWiki} mode
 * @param {Object} docs
 * @return {{ sections: string, toc: string }}
 */
function buildSections( mode, docs ) {
	const { escapeHtml, matchMarks, render } = require( './render.js' );
	const mwModeConfig = require( '../resources/modes/mediawiki/codemirror.mediawiki.config.js' );
	const sections = [];
	const toc = [];
	const inRows = new Set( docs.sections.flatMap( ( section ) => section.rows || [] )
		.flatMap( ( row ) => row.classes ) );

	/**
	 * @param {Object} row
	 * @return {string}
	 */
	const example = ( row ) => '<div class="cm-doc-render cm-mw-theme-default">' +
		render(
			mode,
			row.wikitext,
			row.cursor ? matchMarks( mode, row.wikitext, row.cursor ) : []
		) + '</div>';

	for ( const section of docs.sections ) {
		const id = section.title.toLowerCase().replace( /[^a-z0-9]+/g, '-' );
		let html = `<h2 id="${ id }">${ escapeHtml( section.title ) }</h2>`;
		toc.push( `<li><a href="#${ id }">${ escapeHtml( section.title ) }</a></li>` );

		if ( section.intro ) {
			html += `<p>${ escapeHtml( section.intro ) }</p>`;
		}

		if ( section.grounds ) {
			// The ground classes tint nested regions by depth. They are a mechanical grid, so
			// show every one as a swatch rather than as thirty table rows.
			html += Object.entries( section.notes || {} )
				.map( ( [ name, text ] ) => '<p class="cm-doc-note" ' +
					`id="cm-doc-grounds-${ name }" hidden>${ escapeHtml( text ) }</p>` )
				.join( '' );
			html += '<div class="cm-doc-grounds cm-mw-theme-default" id="cm-doc-grounds">' +
				mwModeConfig.getTagStyles( mode.getParser() )
					.map( ( spec ) => spec.class )
					.filter( ( name ) => name.endsWith( '-ground' ) && !inRows.has( name ) )
					.map( ( name ) => `<div class="cm-doc-ground"><div class="${ name }"></div>` +
						`<code>.${ name }</code></div>` )
					.join( '' ) +
				'</div>';
		}

		if ( section.rows ) {
			html += '<table class="cm-doc-table"><thead><tr>' +
				'<th>CSS class</th><th>Element</th><th>Example</th>' +
				'</tr></thead><tbody>' +
				section.rows.map( ( row ) => '<tr><td class="cm-doc-classes">' +
					row.classes.map( ( name ) => `<code>.${ name }</code>` ).join( '' ) +
					`</td><td class="cm-doc-description">${ escapeHtml( row.description ) }` +
					( row.defaultStyle === 'none' ?
						'<p class="cm-doc-note">No default styling, but available ' +
						'for your own CSS.</p>' :
						'' ) +
					`</td><td class="cm-doc-example">${ example( row ) }</td></tr>` )
					.join( '' ) +
				'</tbody></table>';
		}

		sections.push( html );
	}

	return { sections: sections.join( '\n' ), toc: toc.join( '' ) };
}

async function main() {
	const mode = loadMode();
	const docs = require( './classes.json' );
	const { sections, toc } = buildSections( mode, docs );

	const html = fs.readFileSync( path.join( __dirname, 'template.html' ), 'utf8' )
		.replace( '<!--THEMES-->', () => buildThemeOptions( docs.themes ) )
		.replace( '<!--TOC-->', () => toc )
		.replace( '<!--SECTIONS-->', () => sections )
		.replace( '<!--PLAYGROUND-->', () => require( './render.js' ).escapeHtml( docs.playground ) );

	const [ css, js ] = await Promise.all( [
		Promise.all( LESS_FILES.map( renderLess ) ).then( ( parts ) => parts.join( '\n' ) ),
		bundleDemo()
	] );

	fs.mkdirSync( OUT_DIR, { recursive: true } );
	fs.writeFileSync( path.join( OUT_DIR, 'index.html' ), html );
	fs.writeFileSync( path.join( OUT_DIR, 'styles.css' ), css );
	fs.writeFileSync( path.join( OUT_DIR, 'demo.js' ), js );

	// Without this the publish target holds nothing but directories,
	// and the doc site answers a bare listing.
	fs.copyFileSync(
		path.join( __dirname, 'home.html' ), path.join( DOC_DIR, 'index.html' )
	);

	console.log( `Wikitext style reference written to ${ path.relative( ROOT, OUT_DIR ) }` );
}

main().catch( ( e ) => {
	process.exitCode = 1;
	console.error( e );
} );
