/* eslint-disable-next-line n/no-missing-require */
const { Text } = require( 'ext.CodeMirror.v6.lib' );
const { javascript } = require( '../../../resources/modes/codemirror.mode.exporter.js' );
require( '../../../resources/workers/javascript/worker.min.js' );

const { lintSource, worker } = javascript();
const testCases = [
	{
		title: 'constructor-super',
		input: `class A extends B {
    constructor() { }  // Would throw a ReferenceError.
}`
	},
	{
		title: 'for-direction',
		input: `for (let i = 0; i < 10; i--) {
}`
	},
	{
		title: 'getter-return',
		input: `const p = {
    get name(){
        // no returns.
    }
};`
	},
	{
		title: 'no-case-declarations',
		input: `switch (foo) {
    case 1:
        let x = 1;
        break;
    case 2:
        const y = 2;
        break;
    case 3:
        function f() {}
        break;
    default:
        class C {}
}`
	},
	{
		title: 'no-class-assign',
		input: `class A { }
A = 0;`
	},
	{
		title: 'no-compare-neg-zero',
		input: `if (x === -0) {
    // doSomething()...
}`
	},
	{
		title: 'no-cond-assign',
		input: `let x;
if (x = 0) {
    const b = 1;
}`
	},
	{
		title: 'no-const-assign',
		input: `const a = 0;
a = 1;`
	},
	{
		title: 'no-constant-condition',
		input: `if (false) {
    doSomethingUnfinished();
}`
	},
	{
		title: 'no-control-regex',
		input: 'const pattern1 = /\\x00/;'
	},
	{
		title: 'no-debugger',
		input: `function isTruthy(x) {
    debugger;
    return Boolean(x);
}`
	},
	{
		title: 'no-delete-var',
		input: `let x;
delete x;`
	},
	{
		title: 'no-dupe-class-members',
		input: `class A {
  bar() { }
  bar() { }
}`
	},
	{
		title: 'no-dupe-else-if',
		input: `if (isSomething(x)) {
    foo();
} else if (isSomething(x)) {
    bar();
}`
	},
	{
		title: 'no-dupe-keys',
		input: `const foo = {
    bar: "baz",
    bar: "qux"
};`
	},
	{
		title: 'no-duplicate-case',
		input: `switch (a) {
    case 1:
        break;
    case 2:
        break;
    case 1:         // duplicate test expression
        break;
    default:
        break;
}`
	},
	{
		title: 'no-empty',
		input: `if (foo) {
}`
	},
	{
		title: 'no-empty-character-class',
		input: 'const foo = /^abc[]/;'
	},
	{
		title: 'no-empty-pattern',
		input: 'const {} = foo;'
	},
	{
		title: 'no-ex-assign',
		input: `try {
    // code
} catch (e) {
    e = 10;
}`
	},
	{
		title: 'no-extra-boolean-cast',
		input: 'const foo = !!!bar;'
	},
	{
		title: 'no-fallthrough',
		input: `switch(foo) {
    case 1:
        doSomething();

    case 2:
        doSomething();
}`
	},
	{
		title: 'no-func-assign',
		input: `function foo() {}
foo = bar;`
	},
	{
		title: 'no-global-assign',
		input: 'Object = null'
	},
	{
		title: 'no-inner-declarations',
		input: `if (test) {
    function doSomething() { }
}`
	},
	{
		title: 'no-invalid-regexp',
		input: 'RegExp("[")'
	},
	{
		title: 'no-irregular-whitespace',
		// eslint-disable-next-line no-irregular-whitespace
		input: `const baz = function /*<Ogham Space Mark>*/(){
    return 'test';
}`
	},
	{
		title: 'no-loss-of-precision',
		input: 'const a = 9007199254740993'
	},
	{
		title: 'no-misleading-character-class',
		input: '/^[❇️]$/u;'
	},
	{
		title: 'no-nonoctal-decimal-escape',
		input: '"\\8";'
	},
	{
		title: 'no-obj-calls',
		input: 'const math = Math();'
	},
	{
		title: 'no-octal',
		input: 'const num = 071;'
	},
	{
		title: 'no-prototype-builtins',
		input: 'const hasBarProperty = foo.hasOwnProperty("bar");'
	},
	{
		title: 'no-redeclare',
		input: `var a = 3;
var a = 10;`
	},
	{
		title: 'no-regex-spaces',
		input: 'const re = /foo   bar/;'
	},
	{
		title: 'no-self-assign',
		input: 'foo = foo;'
	},
	{
		title: 'no-setter-return',
		input: `const foo = {
    set a(value) {
        this.val = value;
        return value;
    }
};`
	},
	{
		title: 'no-shadow-restricted-names',
		input: 'function NaN(){}'
	},
	{
		title: 'no-sparse-arrays',
		input: 'const items = [,];'
	},
	{
		title: 'no-this-before-super',
		input: `class A1 extends B {
    constructor() {
        this.a = 0;
        super();
    }
}`
	},
	{
		title: 'no-undef',
		input: 'const foo = someFunction();'
	},
	{
		title: 'no-unexpected-multiline',
		input: `const foo = bar
(1 || 2).baz();`
	},
	{
		title: 'no-unreachable',
		input: `function foo() {
    return true;
    console.log("done");
}`
	},
	{
		title: 'no-unsafe-finally',
		input: `let foo = function() {
    try {
        return 1;
    } catch(err) {
        return 2;
    } finally {
        return 3;
    }
};`
	},
	{
		title: 'no-unsafe-negation',
		input: `if (!key in object) {
    // operator precedence makes it equivalent to (!key) in object
    // and type conversion makes it equivalent to (key ? "false" : "true") in object
}`
	},
	{
		title: 'no-unused-labels',
		input: 'A: var foo = 0;'
	},
	{
		title: 'no-unused-vars',
		input: 'let x;'
	},
	{
		title: 'no-useless-backreference',
		input: '/^(?:(a)|\\1b)$/; // reference to (a) into another alternative'
	},
	{
		title: 'no-useless-catch',
		input: `try {
  doSomethingThatMightThrow();
} catch (e) {
  throw e;
}`
	},
	{
		title: 'no-useless-escape',
		input: '"\\\'";'
	},
	{
		title: 'no-with',
		input: `with (point) {
    r = Math.sqrt(x * x + y * y); // is r a member of point?
}`
	},
	{
		title: 'require-yield',
		input: `function* foo() {
  return 10;
}`
	},
	{
		title: 'use-isnan',
		input: `if (foo == NaN) {
    // ...
}`
	},
	{
		title: 'valid-typeof',
		input: 'typeof foo === "strnig"'
	}
];

const lint = ( code ) => lintSource( { state: { doc: Text.of( code.split( '\n' ) ) } } );

describe( 'CodeMirrorLint: ESLint', () => {
	it( 'should report parsing errors', async () => {
		expect( await lint( 'const' ) ).toStrictEqual( [
			{
				from: 5,
				to: 6,
				severity: 'error',
				rule: null,
				message: 'Parsing error: Unexpected token',
				source: 'ESLint'
			}
		] );
	} );
	for ( const { title, input } of testCases ) {
		it( title, async () => {
			expect( ( await lint( input ) ).some( ( { rule } ) => rule === title ) ).toBeTruthy();
		} );
	}
	it( 'rule customization', async () => {
		worker.setConfig( { rules: { 'no-empty': 0 } } );
		expect( ( await lint( '{}' ) ).length ).toEqual( 0 );
		expect( ( await worker.getConfig() ).rules[ 'no-empty' ] ).toEqual( 0 );
		worker.setConfig( { rules: { semi: 2 } } );
		expect( ( await lint( 'let a' ) ).some( ( { rule } ) => rule === 'semi' ) ).toBeTruthy();
		expect( ( await worker.getConfig() ).rules.semi ).toEqual( 2 );
	} );
} );
