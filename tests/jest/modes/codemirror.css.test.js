/* eslint-disable-next-line n/no-missing-require */
const { Text } = require( 'ext.CodeMirror.v6.lib' );
const { css } = require( '../../../resources/modes/codemirror.css.js' );
require( '../../../resources/workers/css/worker.min.js' );

const { lintSource } = css();
const testCases = [
	{
		title: 'CssSyntaxError',
		input: 'a'
	},
	{
		title: 'annotation-no-unknown',
		input: 'a { color: green !imprtant; }'
	},
	{
		title: 'at-rule-no-unknown',
		input: '@unknown (max-width: 960px) {}'
	},
	{
		title: 'block-no-empty',
		input: 'a { }'
	},
	{
		title: 'color-no-invalid-hex',
		input: 'a { color: #y3 }'
	},
	{
		title: 'comment-no-empty',
		input: '/* */'
	},
	{
		title: 'custom-property-no-missing-var-function',
		input: `:root { --foo: red; }
a { color: --foo; }`
	},
	{
		title: 'declaration-block-no-duplicate-custom-properties',
		input: 'a { --custom-property: pink; --custom-property: orange; }'
	},
	{
		title: 'declaration-block-no-duplicate-properties',
		input: `p {
  font-size: 16px;
  font-weight: 400;
  font-size: 1rem;
}`
	},
	{
		title: 'declaration-block-no-shorthand-property-overrides',
		input: 'a { background-repeat: repeat; background: green; }'
	},
	{
		title: 'font-family-no-duplicate-names',
		input: 'a { font-family: serif, serif; }'
	},
	{
		title: 'font-family-no-missing-generic-family-keyword',
		input: 'a { font: 1em/1.3 Times; }'
	},
	{
		title: 'function-calc-no-unspaced-operator',
		input: 'a { top: calc(1px+2px); }'
	},
	{
		title: 'function-linear-gradient-no-nonstandard-direction',
		input: '.foo { background: linear-gradient(top, #fff, #000); }'
	},
	{
		title: 'function-no-unknown',
		input: 'a { transform: unknown(1); }'
	},
	{
		title: 'keyframe-block-no-duplicate-selectors',
		input: '@keyframes foo { 0% {} 0% {} }'
	},
	{
		title: 'keyframe-declaration-no-important',
		input: `@keyframes foo {
  from { opacity: 0 }
  to { opacity: 1 !important }
}`
	},
	{
		title: 'media-feature-name-no-unknown',
		input: '@media screen and (unknown) {}'
	},
	{
		title: 'media-query-no-invalid',
		input: '@media not(min-width: 300px) {}'
	},
	{
		title: 'named-grid-areas-no-invalid',
		input: 'a { grid-template-areas: "" }'
	},
	{
		title: 'no-descending-specificity',
		input: '#container a { top: 10px; } a { top: 0; }'
	},
	{
		title: 'no-duplicate-at-import-rules',
		input: `@import "a.css";
    @import "a.css";`
	},
	{
		title: 'no-duplicate-selectors',
		input: '.foo {} .bar {} .foo {}'
	},
	{
		title: 'no-empty-source',
		input: ''
	},
	{
		title: 'no-invalid-double-slash-comments',
		input: `a {
  //color: pink;
}`
	},
	{
		title: 'no-invalid-position-at-import-rule',
		input: `a {}
@import 'foo.css';`
	},
	{
		title: 'no-irregular-whitespace',
		input: '.firstClass\u00A0.secondClass {}'
	},
	{
		title: 'property-no-unknown',
		input: `a {
  colr: blue;
}`
	},
	{
		title: 'selector-anb-no-unmatchable',
		input: 'a:nth-child(0n+0) {}'
	},
	{
		title: 'selector-pseudo-class-no-unknown',
		input: 'a:unknown {}'
	},
	{
		title: 'selector-pseudo-element-no-unknown',
		input: 'a::pseudo {}'
	},
	{
		title: 'selector-type-no-unknown',
		input: 'unknown {}'
	},
	{
		title: 'string-no-newline',
		input: `a {
  content: "foo
    bar"; }`
	},
	{
		title: 'unit-no-unknown',
		input: 'a { width: 100pixels; }'
	}
];

const lint = ( code ) => lintSource( { state: { doc: Text.of( code.split( '\n' ) ) } } );

describe( 'CodeMirrorLint: Stylelint', () => {
	for ( const { title, input } of testCases ) {
		it( title, async () => {
			expect( ( await lint( input ) ).some( ( { rule } ) => rule === title ) ).toBeTruthy();
		} );
	}
	it( 'rule customization', async () => {
		lintSource.worker.setConfig( { 'no-empty-source': null } );
		expect( ( await lint( '' ) ).length ).toEqual( 0 );
		expect( ( await lintSource.worker.getConfig() )[ 'no-empty-source' ] ).toEqual( null );
		lintSource.worker.setConfig( { 'length-zero-no-unit': true } );
		expect(
			( await lint( 'a { width: 0px; }' ) )
				.some( ( { rule } ) => rule === 'length-zero-no-unit' )
		).toBeTruthy();
		expect( ( await lintSource.worker.getConfig() )[ 'length-zero-no-unit' ] ).toEqual( true );
	} );
} );
