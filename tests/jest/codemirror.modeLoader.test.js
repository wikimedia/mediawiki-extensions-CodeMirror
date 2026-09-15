const { modeModules, loadLanguageSupport } = require( '../../resources/codemirror.modeLoader.js' );

jest.mock(
	'ext.CodeMirror.modes',
	() => require( '../../resources/modes/codemirror.mode.exporter.js' ),
	{ virtual: true }
);
jest.mock(
	'ext.CodeMirror.modes.extended',
	() => require( '../../resources/modes/codemirror.mode.extended.exporter.js' ),
	{ virtual: true }
);
// The mediawiki and abusefilter modules export a bare factory rather than a map.
const mockMediawikiFactory = jest.fn( ( config ) => ( { language: { name: 'mediawiki' }, config } ) );
jest.mock( 'ext.CodeMirror.mode.mediawiki', () => mockMediawikiFactory, { virtual: true } );
jest.mock(
	'ext.CodeMirror.abusefilter',
	() => () => ( { language: { name: 'abusefilter' } } ),
	{ virtual: true }
);

describe( 'codemirror.modeLoader', () => {
	beforeEach( () => {
		mw.loader.using = jest.fn().mockResolvedValue();
	} );

	it( 'maps every mode to a module', () => {
		for ( const [ mode, moduleName ] of Object.entries( modeModules ) ) {
			expect( typeof mode ).toBe( 'string' );
			expect( moduleName ).toMatch( /^ext\.CodeMirror/ );
		}
	} );

	it( 'loads the mode module', async () => {
		await loadLanguageSupport( 'javascript' );
		expect( mw.loader.using ).toHaveBeenCalledWith( 'ext.CodeMirror.modes' );
	} );

	it( 'routes extended modes to the extended module', async () => {
		await loadLanguageSupport( 'python' );
		expect( mw.loader.using ).toHaveBeenCalledWith( 'ext.CodeMirror.modes.extended' );
	} );

	it.each( [ 'javascript', 'css', 'json', 'jsonc', 'lua', 'vue', 'html' ] )(
		'resolves %s from ext.CodeMirror.modes',
		async ( mode ) => {
			const support = await loadLanguageSupport( mode );
			expect( support.language.name ).toBe( mode );
		}
	);

	it.each( [ 'python', 'yaml', 'sparql', 'handlebars', 'mustache' ] )(
		'resolves %s from the extended module',
		async ( mode ) => {
			const support = await loadLanguageSupport( mode );
			expect( support.language.name ).toBe( mode );
		}
	);

	it( 'handles a module that exports a bare factory', async () => {
		const support = await loadLanguageSupport( 'abusefilter' );
		expect( support.language.name ).toBe( 'abusefilter' );
	} );

	it( 'passes the config through to the mode', async () => {
		const config = { bidiIsolation: true };
		const support = await loadLanguageSupport( 'mediawiki', config );
		expect( support.config ).toBe( config );
	} );

	it( 'rejects an unknown mode', async () => {
		await expect( loadLanguageSupport( 'klingon' ) )
			.rejects.toThrow( 'Unknown mode "klingon"' );
		expect( mw.loader.using ).not.toHaveBeenCalled();
	} );

	it( 'rejects when the module does not provide the mode', async () => {
		modeModules.bogus = 'ext.CodeMirror.modes';
		await expect( loadLanguageSupport( 'bogus' ) )
			.rejects.toThrow( 'is not provided by ext.CodeMirror.modes' );
		delete modeModules.bogus;
	} );
} );
