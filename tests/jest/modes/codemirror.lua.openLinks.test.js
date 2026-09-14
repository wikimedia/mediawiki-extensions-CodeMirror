/* eslint-disable-next-line n/no-missing-require */
const { EditorState } = require( 'ext.CodeMirror.lib' );
const CodeMirrorLua = require( '../../../resources/modes/codemirror.lua.js' );
const { lua } = require( '../../../resources/modes/codemirror.mode.exporter.js' );

describe( 'resolveLinkAt', () => {
	const langSupport = lua();

	/**
	 * Resolve the link at the first occurrence of a substring.
	 *
	 * @param {string} doc Source wikitext
	 * @param {string} needle Substring whose first character is clicked
	 * @return {Object|null}
	 */
	const resolveAt = ( doc, needle ) => {
		const state = EditorState.create( { doc, extensions: langSupport.language } );
		return CodeMirrorLua.resolveLinkAt( state, doc.indexOf( needle ) );
	};

	beforeEach( () => {
		// The shared mock returns a title object without getUrl(), so stand in a real one.
		mw.Title.newFromText = jest.fn().mockImplementation( ( text, ns = 0 ) => {
			if ( !text ) {
				return null;
			} else if ( text.startsWith( 'Module:' ) ) {
				ns = 828;
			}
			return {
				getUrl: () => `/wiki/${ ns }:${ text }`,
				getNamespaceId: () => ns
			};
		} );
	} );

	it( 'should resolve an argument of mw.loadJsonData', () => {
		const link = resolveAt( 'mw.loadJsonData("Foo")', 'Foo' );
		expect( link ).toEqual( { url: '/wiki/0:Foo', from: 17, to: 20 } );
	} );

	it( 'should resolve an argument of mw.ext.TemplateStyles.link', () => {
		const link = resolveAt( "mw.ext.TemplateStyles.link('Foo')", 'Foo' );
		expect( link ).toEqual( { url: '/wiki/0:Foo', from: 28, to: 31 } );
	} );

	it( 'should resolve an argument of require', () => {
		const link = resolveAt( "require('Module:Foo')", 'Foo' );
		expect( link ).toEqual( { url: '/wiki/828:Module:Foo', from: 9, to: 19 } );
	} );

	it( 'should resolve an argument of mw.loadData', () => {
		const link = resolveAt( 'mw.loadData("Module:Foo")', 'Foo' );
		expect( link ).toEqual( { url: '/wiki/828:Module:Foo', from: 13, to: 23 } );
	} );

	it( 'should return null for non-string', () => {
		expect( resolveAt( 'local foo = 1', 'foo' ) ).toBeNull();
	} );

	it( 'should return null for a string not in a function call', () => {
		expect( resolveAt( 'local foo = "Bar"', 'Bar' ) ).toBeNull();
	} );

	it( 'should return null for unsupported functions', () => {
		expect( resolveAt( 'foo("Bar")', 'Bar' ) ).toBeNull();
	} );

	it( 'should return null for requiring libraries', () => {
		expect( resolveAt( 'require("strict")', 'strict' ) ).toBeNull();
	} );
} );
