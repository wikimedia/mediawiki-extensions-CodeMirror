/* eslint-disable-next-line n/no-missing-require */
const { CompletionContext } = require( 'ext.CodeMirror.lib' );
const CodeMirror = require( '../../../resources/codemirror.js' );
const { mediawiki } = require( '../../../resources/modes/mediawiki/codemirror.mediawiki.js' );
const mwModeConfig = require( '../../../resources/modes/mediawiki/codemirror.mediawiki.config.js' );

// Setup CodeMirror instance.
const textarea = document.createElement( 'textarea' );
document.body.appendChild( textarea );
const cm = new CodeMirror( textarea, mediawiki() );
cm.initialize();
const [ source ] = cm.view.state.languageDataAt( 'autocomplete' );

/**
 * Create a completion context at a specific position.
 *
 * @return {CompletionContext}
 */
const createCompletionContext = () => new CompletionContext(
	cm.view.state,
	/** @see https://github.com/codemirror/autocomplete/blob/62dead94d0f4b256f0b437b4733cfef6449e8453/src/completion.ts#L273 */
	cm.view.state.selection.main.from,
	false,
	cm.view
);

describe( 'MediaWiki autocomplete', () => {
	it( 'parser functions (without #)', async () => {
		cm.view.dispatch( {
			changes: { from: 0, to: cm.view.state.doc.length, insert: '{{ מיון רגיל' },
			selection: { anchor: 4, head: 4 }
		} );
		expect( await source( createCompletionContext() ) ).toEqual( {
			from: 3,
			options: [
				{ label: '#ifexist', type: 'function' },
				{ label: '#invoke', type: 'function' },
				{ label: '#lst', type: 'function' },
				{ label: '#special', type: 'function' },
				{ label: 'filepath', type: 'function' },
				{ label: 'int', type: 'function' },
				{ label: 'ns', type: 'function' },
				{ label: '!', type: 'constant' },
				{ label: 'מיון רגיל', type: 'constant' }
			]
		} );
	} );

	it( 'parser functions (with #)', async () => {
		cm.view.dispatch( {
			changes: { from: 0, to: cm.view.state.doc.length, insert: '{{ #' },
			selection: { anchor: 4, head: 4 }
		} );
		expect( await source( createCompletionContext() ) ).toEqual( {
			from: 3,
			options: [
				{ label: '#ifexist', type: 'function' },
				{ label: '#invoke', type: 'function' },
				{ label: '#lst', type: 'function' },
				{ label: '#special', type: 'function' },
				{ label: 'filepath', type: 'function' },
				{ label: 'int', type: 'function' },
				{ label: 'ns', type: 'function' },
				{ label: '!', type: 'constant' },
				{ label: 'מיון רגיל', type: 'constant' }
			]
		} );
	} );

	it( 'behavior switch', () => {
		cm.view.dispatch( {
			changes: { from: 0, to: cm.view.state.doc.length, insert: '__no' },
			selection: { anchor: 4, head: 4 }
		} );
		expect( source( createCompletionContext() ) ).toEqual( {
			from: 0,
			options: [ { label: '__NOTOC__', type: 'constant' } ],
			validFor: /^[^\s<>[\]{}|#]*$/
		} );
	} );

	it( 'closing nowiki tag', () => {
		cm.view.dispatch( {
			changes: { from: 0, to: cm.view.state.doc.length, insert: '<nowiki></' },
			selection: { anchor: 10, head: 10 }
		} );
		expect( source( createCompletionContext() ) ).toEqual( {
			from: 10,
			options: [
				...Object.keys( mwModeConfig.permittedHtmlTags )
					.filter( ( label ) => !( label in mwModeConfig.implicitlyClosedHtmlTags ) )
					.map( ( label ) => ( { label, type: 'type', apply: `${ label }>` } ) ),
				{ label: 'nowiki', type: 'type', boost: 50, apply: 'nowiki>' }
			],
			validFor: /^[a-z\d]*$/i
		} );
	} );

	it( 'closing indicator tag', () => {
		cm.view.dispatch( {
			changes: { from: 0, to: cm.view.state.doc.length, insert: '<indicator></' },
			selection: { anchor: 13, head: 13 }
		} );
		expect( source( createCompletionContext() ) ).toEqual( {
			from: 13,
			options: [
				...Object.keys( mwModeConfig.permittedHtmlTags )
					.filter( ( label ) => !( label in mwModeConfig.implicitlyClosedHtmlTags ) )
					.map( ( label ) => ( { label, type: 'type', apply: `${ label }>` } ) ),
				{ label: 'indicator', type: 'type', boost: 50, apply: 'indicator>' }
			],
			validFor: /^[a-z\d]*$/i
		} );
	} );

	it( 'closing ref tag', () => {
		cm.view.dispatch( {
			changes: { from: 0, to: cm.view.state.doc.length, insert: '<ref></' },
			selection: { anchor: 7, head: 7 }
		} );
		expect( source( createCompletionContext() ) ).toEqual( {
			from: 7,
			options: [
				...Object.keys( mwModeConfig.permittedHtmlTags )
					.filter( ( label ) => !( label in mwModeConfig.implicitlyClosedHtmlTags ) )
					.map( ( label ) => ( { label, type: 'type', apply: `${ label }>` } ) ),
				{ label: 'ref', type: 'type', boost: 50, apply: 'ref>' }
			],
			validFor: /^[a-z\d]*$/i
		} );
	} );

	it( 'closing HTML tag', () => {
		cm.view.dispatch( {
			changes: { from: 0, to: cm.view.state.doc.length, insert: '<div><p></' },
			selection: { anchor: 10, head: 10 }
		} );
		expect( source( createCompletionContext() ) ).toEqual( {
			from: 10,
			options: [
				...Object.keys( mwModeConfig.permittedHtmlTags )
					.filter( ( label ) => !( label in mwModeConfig.implicitlyClosedHtmlTags ) )
					.map( ( label ) => Object.assign(
						{ label, type: 'type', apply: `${ label }>` },
						label === 'p' ? { boost: 99 } : {}
					) )
			],
			validFor: /^[a-z\d]*$/i
		} );
	} );

	it( 'opening tag', () => {
		cm.view.dispatch( {
			changes: { from: 0, to: cm.view.state.doc.length, insert: '<now' },
			selection: { anchor: 4, head: 4 }
		} );
		expect( source( createCompletionContext() ) ).toEqual( {
			from: 1,
			options: [
				...Object.keys( mwModeConfig.permittedHtmlTags ).map( ( label ) => ( { label, type: 'type' } ) ),
				{ label: 'nowiki', type: 'type' },
				{ label: 'indicator', type: 'type' },
				{ label: 'gallery', type: 'type' },
				{ label: 'ref', type: 'type' },
				{ label: 'pre', type: 'type' },
				{ label: 'references', type: 'type' },
				{ label: 'templatestyles', type: 'type' },
				{ label: 'myextension', type: 'type' }
			],
			validFor: /^[a-z\d]*$/i
		} );
	} );

	it( 'protocol', () => {
		cm.view.dispatch( {
			changes: { from: 0, to: cm.view.state.doc.length, insert: '[htt' },
			selection: { anchor: 4, head: 4 }
		} );
		expect( source( createCompletionContext() ) ).toEqual( {
			from: 1,
			options: [
				{ label: 'ftp://', type: 'namespace' },
				{ label: 'https://', type: 'namespace' },
				{ label: 'news:', type: 'namespace' }
			],
			validFor: /^[a-z:/]*$/i
		} );
	} );
} );

describe( 'MediaWiki autocomplete: page title search', () => {
	let request;

	beforeEach( () => {
		request = Promise.resolve( [ '', [ 'Foo', 'Foobar' ] ] );
		request.abort = jest.fn();
		mw.Api.prototype.get = jest.fn().mockReturnValue( request );
		mw.Api.prototype.abort.mockClear();
		cm.view.dispatch( {
			changes: { from: 0, to: cm.view.state.doc.length, insert: '[[Foo' },
			selection: { anchor: 5, head: 5 }
		} );
	} );

	afterEach( () => {
		mw.Api.prototype.get = jest.fn().mockReturnValue( Promise.resolve( {} ) );
	} );

	it( 'should request only 10 results', async () => {
		const { options } = await source( createCompletionContext() );
		expect( mw.Api.prototype.get ).toHaveBeenCalledWith( {
			action: 'opensearch',
			search: 'Foo',
			namespace: 0,
			limit: 10
		} );
		expect( options.map( ( { label } ) => label ) ).toEqual( [ 'Foo', 'Foobar' ] );
	} );

	it( 'should leave filtering and ranking to the search engine', async () => {
		const result = await source( createCompletionContext() );
		expect( result.filter ).toBe( false );
		// The parser function branch merges in a static list, so it must filter.
		cm.view.dispatch( {
			changes: { from: 0, to: cm.view.state.doc.length, insert: '{{ #' },
			selection: { anchor: 4, head: 4 }
		} );
		expect( await source( createCompletionContext() ) ).not.toHaveProperty( 'filter' );
	} );

	it( 'should abort in-flight requests before issuing a new one', async () => {
		await Promise.all( [
			source( createCompletionContext() ),
			source( createCompletionContext() )
		] );
		const { invocationCallOrder: aborts } = mw.Api.prototype.abort.mock,
			{ invocationCallOrder: gets } = mw.Api.prototype.get.mock;
		expect( aborts ).toHaveLength( 2 );
		expect( gets ).toHaveLength( 2 );
		expect( aborts[ 0 ] ).toBeLessThan( gets[ 0 ] );
		expect( aborts[ 1 ] ).toBeLessThan( gets[ 1 ] );
	} );

	it( 'should abort the request when the query is superseded', async () => {
		const context = createCompletionContext(),
			addEventListener = jest.spyOn( context, 'addEventListener' );
		await source( context );
		expect( addEventListener ).toHaveBeenCalledWith(
			'abort',
			expect.any( Function ),
			{ onDocChange: true }
		);
		// The plugin reads this flag to abort the query on any document change.
		expect( context.abortOnDocChange ).toBe( true );
		addEventListener.mock.calls[ 0 ][ 1 ]();
		expect( request.abort ).toHaveBeenCalledTimes( 1 );
	} );
} );
