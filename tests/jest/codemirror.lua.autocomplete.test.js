/* eslint-disable-next-line n/no-missing-require */
const { CompletionContext } = require( 'ext.CodeMirror.v6.lib' );
const CodeMirror = require( '../../resources/codemirror.js' );
const { lua } = require( '../../resources/codemirror.lua.js' );

// Setup CodeMirror instance.
const textarea = document.createElement( 'textarea' );
document.body.appendChild( textarea );
const cm = new CodeMirror( textarea, lua() );
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
	true,
	cm.view
);

const test = ( insert, results ) => {
	cm.view.dispatch( {
		changes: { from: 0, to: cm.view.state.doc.length, insert },
		selection: { anchor: insert.length, head: insert.length }
	} );
	const completion = source( createCompletionContext() );
	expect(
		completion && completion.options.filter(
			( option ) => option.label.toLowerCase()
				.startsWith( insert.slice( completion.from ).toLowerCase() )
		).map( ( { label, type, detail } ) => ( { label, type, detail } ) )
	).toEqual( results );
};

describe( 'Lua autocompletion', () => {
	it( 'should not autocomplete in comments', () => {
		test( '-- a', null );
		test( '--[[\na', null );
	} );
	it( 'should not autocomplete in strings', () => {
		test( '"a', null );
		test( "'a", null );
		test( '[[a', null );
		test( '[=[a', null );
	} );
	it( 'should autocomplete object access', () => {
		test(
			'package.',
			[
				{ label: 'loaded', type: 'interface' },
				{ label: 'loaders', type: 'interface' },
				{ label: 'preload', type: 'interface' },
				{ label: 'seeall', type: 'function' }
			]
		);
		test(
			'mw.site.stats.us',
			[
				{ label: 'users', type: 'constant' },
				{ label: 'usersInGroup', type: 'function' }
			]
		);
	} );
	it( 'should autocomplete after a length operator', () => {
		test(
			'#_',
			[ { label: '_G', type: 'namespace' } ]
		);
	} );
	it( 'should autocomplete after a binary operator', () => {
		test(
			'a + n',
			[ { label: 'next', type: 'function' } ]
		);
	} );
	it( 'should autocomplete field names', () => {
		test(
			'a[ n',
			[ { label: 'next', type: 'function' } ]
		);
	} );
	it( 'should autocomplete table constructors', () => {
		test(
			'{ f',
			[
				{ label: 'false', type: 'constant' },
				{ label: 'function', type: 'keyword' },
				{ label: 'function', type: 'keyword', detail: 'definition' }
			]
		);
	} );
	it( 'should autocomplete after a parenthesis', () => {
		test(
			'f( n',
			[
				{ label: 'nil', type: 'constant' },
				{ label: 'next', type: 'function' },
				{ label: 'not', type: 'keyword' }
			]
		);
	} );
	it( 'should autocomplete assignments', () => {
		test(
			'a = n',
			[
				{ label: 'nil', type: 'constant' },
				{ label: 'next', type: 'function' },
				{ label: 'not', type: 'keyword' }
			]
		);
		test(
			'a, b = 0, n',
			[
				{ label: 'nil', type: 'constant' },
				{ label: 'next', type: 'function' },
				{ label: 'not', type: 'keyword' }
			]
		);
	} );
	it( 'should autocomplete after a closing bracket', () => {
		test(
			'{0} o',
			[ { label: 'or', type: 'keyword' } ]
		);
		test(
			'a[0] t',
			[ { label: 'then', type: 'keyword' } ]
		);
	} );
	it( 'should autocomplete after a newline', () => {
		test(
			'  f',
			[
				{ label: 'for', type: 'keyword' },
				{ label: 'for', type: 'keyword', detail: 'loop' },
				{ label: 'for', type: 'keyword', detail: 'in loop' },
				{ label: 'function', type: 'keyword' },
				{ label: 'function', type: 'keyword', detail: 'definition' },
				{ label: 'false', type: 'constant' }
			]
		);
		test(
			'f(); re',
			[
				{ label: 'repeat', type: 'keyword' },
				{ label: 'repeat', type: 'keyword', detail: 'loop' },
				{ label: 'return', type: 'keyword' },
				{ label: 'require', type: 'function' }
			]
		);
	} );
	it( 'should autocomplete after a space', () => {
		test(
			'a o',
			[ { label: 'or', type: 'keyword' } ]
		);
		test(
			'a or o',
			[ { label: 'os', type: 'namespace' } ]
		);
	} );
} );
