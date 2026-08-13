/* eslint-disable-next-line n/no-missing-require */
const { EditorState } = require( 'ext.CodeMirror.lib' );
const CodeMirror = require( '../../../resources/codemirror.js' );
const { mediawiki } = require( '../../../resources/modes/mediawiki/codemirror.mediawiki.js' );

describe( 'CodeMirrorOpenLinks', () => {
	let cm;

	beforeEach( () => {
		const textarea = document.createElement( 'textarea' );
		document.body.appendChild( textarea );
		cm = new CodeMirror( textarea, mediawiki() );
		cm.initialize();
		cm.textSelection.setContents( '[[Foo]] {{bar}} https://example.org' );
	} );

	it( 'should add .cm-mw-open-links to page titles', () => {
		cm.view.contentDOM.dispatchEvent( new KeyboardEvent( 'keydown', { key: 'Control', bubbles: true } ) );
		expect( cm.view.contentDOM.classList ).toContain( 'cm-mw-open-links' );
		cm.view.contentDOM.dispatchEvent( new KeyboardEvent( 'keyup', { key: 'Control', bubbles: true } ) );
		expect( cm.view.contentDOM.classList ).not.toContain( 'cm-mw-open-links' );
	} );

	it( 'should remove .cm-mw-open-links if the document becomes hidden', () => {
		cm.view.contentDOM.dispatchEvent( new KeyboardEvent( 'keydown', { key: 'Control', bubbles: true } ) );
		expect( cm.view.contentDOM.classList ).toContain( 'cm-mw-open-links' );
		expect( document.hidden ).toBe( false );
		Object.defineProperty( document, 'hidden', { value: true, writable: true } );
		document.dispatchEvent( new Event( 'visibilitychange' ) );
		expect( cm.view.contentDOM.classList ).not.toContain( 'cm-mw-open-links' );
		// Reset the hidden property
		Object.defineProperty( document, 'hidden', { value: false, writable: true } );
	} );
} );

describe( 'openLinks support', () => {
	// The shared jsdom setup reports a linux platform, so the modifier is Control.
	it( 'should expose the modifier through the mode', () => {
		const { modKey, hasModifier } = mediawiki().openLinks;
		expect( modKey ).toBe( 'Control' );
		expect( hasModifier( { ctrlKey: true } ) ).toBe( true );
		expect( hasModifier( { ctrlKey: false, metaKey: true } ) ).toBe( false );
	} );
} );

describe( 'resolveLinkAt', () => {
	let langSupport;

	/**
	 * Resolve the link at the first occurrence of a substring.
	 *
	 * @param {string} doc Source wikitext
	 * @param {string} needle Substring whose first character is clicked
	 * @return {Object|null}
	 */
	const resolveAt = ( doc, needle ) => {
		const state = EditorState.create( { doc, extensions: langSupport.language } );
		return langSupport.openLinks.resolveLinkAt( state, doc.indexOf( needle ) );
	};

	beforeEach( () => {
		// The shared mock returns a title object without getUrl(), so stand in a real one.
		mw.Title.newFromText = jest.fn().mockImplementation( ( text, ns = 0 ) => (
			text ? { getUrl: () => `/wiki/${ ns }:${ text }` } : null
		) );
		langSupport = mediawiki( {
			bidiIsolation: false,
			codeFolding: false,
			autocomplete: false,
			openLinks: false
		} );
	} );

	it( 'should resolve an internal link to the main namespace', () => {
		const link = resolveAt( '[[Foo bar]]', 'Foo' );
		expect( link ).toEqual( { url: '/wiki/0:Foo bar', from: 2, to: 9 } );
	} );

	it( 'should resolve only the target of a piped link', () => {
		const link = resolveAt( '[[Foo|label]]', 'Foo' );
		expect( link.url ).toBe( '/wiki/0:Foo' );
		expect( link.to ).toBe( 5 );
	} );

	it( 'should resolve a template to the Template namespace', () => {
		const link = resolveAt( '{{Bar}}', 'Bar' );
		expect( link ).toEqual( { url: '/wiki/10:Bar', from: 2, to: 5 } );
	} );

	it( 'should resolve a parser function target to its own namespace', () => {
		// #invoke is configured with namespace 828 (Module) in the shared setup.
		const link = resolveAt( '{{#invoke:Foo|bar}}', 'Foo' );
		expect( link.url ).toBe( '/wiki/828:Foo' );
	} );

	it( 'should span the protocol and the URL of an external link', () => {
		const doc = '[https://example.org label]';
		const link = resolveAt( doc, 'https' );
		expect( link.url ).toBe( 'https://example.org' );
		expect( link.from ).toBe( 1 );
	} );

	it( 'should span the protocol when the URL itself is clicked', () => {
		const doc = '[https://example.org label]';
		const link = resolveAt( doc, 'example' );
		expect( link.url ).toBe( 'https://example.org' );
		expect( link.from ).toBe( 1 );
	} );

	it( 'should resolve a free external link', () => {
		const link = resolveAt( 'see https://example.org/x now', 'https' );
		expect( link.url ).toBe( 'https://example.org/x' );
	} );

	it( 'should resolve a subpage link against the current page', () => {
		mockMwConfigGet( { wgPageName: 'Foo/Bar' } );
		const link = resolveAt( '[[/Baz]]', '/Baz' );
		expect( link.url ).toBe( '/wiki/0::Foo/Bar/Baz' );
	} );

	it( 'should resolve a relative link by walking up the subpage path', () => {
		mockMwConfigGet( { wgPageName: 'Foo/Bar' } );
		const link = resolveAt( '[[../Baz]]', '../' );
		expect( link.url ).toBe( '/wiki/0::Foo/Baz' );
	} );

	it( 'should give up when a relative link walks past the root', () => {
		mockMwConfigGet( { wgPageName: 'Foo' } );
		expect( resolveAt( '[[../Baz]]', '../' ) ).toBeNull();
	} );

	it( 'should return null for plain text', () => {
		expect( resolveAt( 'no links at all', 'links' ) ).toBeNull();
	} );

	it( 'should return null on the brackets rather than the target', () => {
		expect( resolveAt( '[[Foo]]', '[[' ) ).toBeNull();
	} );

	it( 'should return null when the title is not a valid page name', () => {
		mw.Title.newFromText = jest.fn().mockReturnValue( null );
		expect( resolveAt( '[[Foo]]', 'Foo' ) ).toBeNull();
	} );
} );
