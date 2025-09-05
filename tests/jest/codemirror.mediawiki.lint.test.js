/* eslint-disable-next-line n/no-missing-require */
const { Text } = require( 'ext.CodeMirror.v6.lib' );
const lintSource = require( '../../resources/modes/mediawiki/codemirror.mediawiki.lint.js' );
require( '../../resources/workers/mediawiki/worker.min.js' );

const testCases = [
	{
		title: 'bold in section header (bold-header)',
		input: '==\'\'\'foo\'\'\'==',
		severity: 'info',
		actions: [ 'remove' ]
	},
	{
		title: 'unbalanced italic apostrophes in a section header (format-leakage)',
		input: '==\'\'foo==',
		severity: 'info',
		actions: [ 'close' ]
	},
	{
		title: 'content to be moved outside the table (fostered-content)',
		input: '{|\nFoo\n|}',
		severity: 'warning'
	},
	{
		title: '<h1> (h1)',
		input: '=Foo=',
		severity: 'warning',
		actions: [ 'h2' ]
	},
	{
		title: 'nonzero tabindex (illegal-attr)',
		input: '<br tabindex="1">',
		severity: 'warning',
		actions: [ 'remove', '0 tabindex' ]
	},
	{
		title: 'invalid attribute name (illegal-attr)',
		input: '<br hidden>',
		severity: 'error',
		actions: [ 'remove' ]
	},
	{
		title: 'invalid attribute value (illegal-attr)',
		input: '<ol type="x"></ol>',
		severity: 'error'
	},
	{
		title: 'invalid gallery image (invalid-gallery)',
		input: '<gallery>Template:Foo</gallery>',
		severity: 'error',
		actions: [ 'insert a namespace prefix' ]
	},
	{
		title: 'imagemap without an image (invalid-imagemap)',
		input: '<imagemap>foo</imagemap>',
		severity: 'error'
	},
	{
		title: 'invalid link in imagemap (invalid-imagemap)',
		input: `<imagemap>
File:foo.jpg
bar
</imagemap>`,
		severity: 'error',
		actions: [ 'remove', 'comment out' ]
	},
	{
		title: 'missing Scribunto module function name (invalid-invoke)',
		input: '{{#invoke:foo}}',
		severity: 'error'
	},
	{
		title: 'invalid Scribunto module name (invalid-invoke)',
		input: '{{#invoke:..|foo}}',
		severity: 'error'
	},
	{
		title: 'invalid ISBN (invalid-isbn)',
		input: 'ISBN 978-3-16-148410-1',
		severity: 'error'
	},
	{
		title: 'lonely "]" (lonely-bracket)',
		input: 'https://example.com]',
		severity: 'error',
		actions: [ 'insert an opening bracket' ]
	},
	{
		title: 'internal link in an external link (nested-link)',
		input: '[https://example.com [[foo]]]',
		severity: 'error',
		actions: [ 'delink' ]
	},
	{
		title: 'duplicate id attribute (no-duplicate)',
		input: '<br id="foo" id="bar">',
		severity: 'error',
		actions: [ 'remove' ]
	},
	{
		title: 'conflicting image horizontal-alignment parameter (no-duplicate)',
		input: '[[file:foo.jpg|left|none]]',
		severity: 'error',
		actions: [ 'remove' ]
	},
	{
		title: 'duplicate image framed parameter (no-duplicate)',
		input: '[[file:foo.jpg|frame|framed]]',
		severity: 'error',
		actions: [ 'remove' ]
	},
	{
		title: 'duplicate template parameter (no-duplicate)',
		input: '{{foo|bar|1=baz}}',
		severity: 'error',
		actions: [ 'remove' ]
	},
	{
		title: 'invisible content inside triple braces (no-ignored)',
		input: '{{{|foo|bar}}}',
		severity: 'error',
		actions: [ 'remove', 'escape' ]
	},
	{
		title: 'attributes of a closing tag (no-ignored)',
		input: '<p></p id="foo">',
		severity: 'error',
		actions: [ 'remove', 'convert to an opening tag' ]
	},
	{
		title: 'invalid conversion flag (no-ignored)',
		input: '-{r|foo}-',
		severity: 'error',
		actions: [ 'convert to uppercase' ]
	},
	{
		title: 'element containing an invalid attribute name (no-ignored)',
		input: `{|
!!id="foo"|
|}`,
		severity: 'error',
		actions: [ 'remove' ]
	},
	{
		title: 'invalid parameter of inputbox (no-ignored)',
		input: '<inputbox>[</inputbox>',
		severity: 'error',
		actions: [ 'remove' ]
	},
	{
		title: 'invalid content in references (no-ignored)',
		input: '<references>foo</references>',
		severity: 'error',
		actions: [ 'remove', 'comment out' ]
	},
	{
		title: 'extension tag in HTML tag attributes (parsing-order)',
		input: '<br <ref name="foo"/> >',
		severity: 'error'
	},
	{
		title: 'section header in HTML tag attributes (parsing-order)',
		input: `<br
==foo==
>`,
		severity: 'error'
	},
	{
		title: 'HTML tag in table attributes (parsing-order)',
		input: `{|<br>
|}`,
		actions: [ 'remove' ],
		severity: 'error'
	},
	{
		title: 'additional "|" in a table cell (pipe-like)',
		input: `{|
|
a || b
|}`,
		actions: [ 'insert a newline' ],
		severity: 'error'
	},
	{
		title: 'lonely "<" (tag-like)',
		input: '<ref>',
		severity: 'error',
		actions: [ 'escape' ]
	},
	{
		title: 'unbalanced "=" in a section header (unbalanced-header)',
		input: '==foo===',
		actions: [ 'h2', 'h3' ],
		severity: 'error'
	},
	{
		title: 'unescaped query string in an anonymous parameter (unescaped)',
		input: '{{foo|https://example.com/?bar=1}}',
		severity: 'error',
		actions: [ 'escape' ]
	},
	{
		title: 'nothing should be in templatestyles (void-ext)',
		input: '<templatestyles>foo</templatestyles>',
		severity: 'error',
		actions: [ 'remove' ]
	}
];

lintSource.worker.setConfig( {
	ext: [ 'imagemap', 'ref', 'references', 'gallery', 'inputbox', 'templatestyles' ],
	doubleUnderscore: [ [], [] ],
	img: {
		framed: 'framed',
		frame: 'framed',
		left: 'left',
		none: 'none'
	},
	functionHook: [ 'invoke' ],
	variants: [ 'foo', 'bar' ]
} );

const lint = ( code ) => lintSource( { state: { doc: Text.of( code.split( '\n' ) ) } } );

describe( 'CodeMirrorLint: WikiLint', () => {
	for ( const { title, input, severity, actions = [] } of testCases ) {
		it( title, async () => {
			const [ error ] = await lint( input );
			expect( error.message ).toEqual( title );
			expect( error.severity ).toEqual( severity );
			expect( error.actions.map( ( { name } ) => name ) ).toEqual( actions );
		} );
	}
} );
