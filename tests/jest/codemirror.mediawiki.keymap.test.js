const CodeMirror = require( '../../resources/codemirror.js' );
const mwKeymap = require( '../../resources/codemirror.mediawiki.keymap.js' );

describe( 'CodeMirrorMediaWikiKeymap', () => {
	let cm;

	beforeEach( () => {
		const textarea = document.createElement( 'textarea' );
		const form = document.createElement( 'form' );
		form.appendChild( textarea );
		cm = new CodeMirror( textarea );
		cm.initialize();
		// Mocks wgCiteResponsiveReferences
		mw.config.get = jest.fn().mockReturnValue( true );
		mwKeymap( cm );
	} );

	const headingTestCases = [
		{
			content: 'Foo\nBar',
			start: 0,
			end: 0,
			heading: 2,
			expected: '== Foo ==\nBar'
		},
		{
			content: 'Foo\n\n\nBar',
			start: 4,
			end: 4,
			heading: 3,
			expected: 'Foo\n=== codemirror-keymap-heading-n ===\n\nBar'
		},
		{
			content: 'Foo\n\n\nBar\n\n\nBaz',
			start: 0,
			end: 15,
			heading: 1,
			expected: '= Foo =\n\n\n= Bar =\n\n\n= Baz ='
		}
	];
	it.each( headingTestCases )( 'should add a heading to the content', ( { content, start, end, heading, expected } ) => {
		cm.textSelection.setContents( content );
		cm.textSelection.setSelection( { start, end } );
		cm.view.contentDOM.dispatchEvent( new KeyboardEvent( 'keydown', { key: heading, ctrlKey: true } ) );
		expect( cm.textSelection.getContents() ).toStrictEqual( expected );
	} );

	it( 'should add a reference via Mod-Shift-k if the Cite extension is enabled', () => {
		cm.view.contentDOM.dispatchEvent( new KeyboardEvent( 'keydown', { key: 'K', ctrlKey: true, shiftKey: true } ) );
		expect( cm.textSelection.getContents() ).toStrictEqual( '<ref></ref>' );
	} );

	const formattingTestCases = [
		{
			title: 'italics',
			key: 'i',
			expected: "''Foo''"
		},
		{
			title: 'bold',
			key: 'b',
			expected: "'''Foo'''"
		},
		{
			title: 'link',
			key: 'k',
			expected: '[[Foo]]'
		},
		{
			title: 'subscript',
			key: ',',
			expected: '<sub>Foo</sub>'
		},
		{
			title: 'superscript',
			key: '.',
			expected: '<sup>Foo</sup>'
		},
		{
			title: 'underline',
			key: 'u',
			expected: '<u>Foo</u>'
		}
	];
	it.each( formattingTestCases )( '$title', ( { key, expected } ) => {
		cm.textSelection.setContents( 'Foo' );
		cm.textSelection.setSelection( { start: 0, end: 3 } );
		cm.view.contentDOM.dispatchEvent( new KeyboardEvent( 'keydown', {
			key,
			ctrlKey: true
		} ) );
		expect( cm.textSelection.getContents() ).toStrictEqual( expected );
	} );
} );
