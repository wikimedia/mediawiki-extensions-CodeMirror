/* eslint-disable jest/expect-expect */
const jsonLint = require( '../../../resources/modes/json/codemirror.json.lint.js' );

const lintJSONNative = ( str ) => {
	if ( str.trim() ) {
		try {
			JSON.parse( str );
		} catch ( e ) {
			const { message } = e,
				mt = /\bposition (\d+)/u.exec( message );
			return mt && Number( mt[ 1 ] );
		}
	}
};

const lintJSON = ( str ) => {
	try {
		jsonLint( str );
		return [];
	} catch ( e ) {
		if ( e instanceof Error ) {
			throw e;
		}
		const { warnings } = e;
		if ( e.message ) {
			warnings.push( e );
		}
		return warnings;
	}
};

const isValid = ( data ) => {
	expect( lintJSON( data ) ).toHaveLength( 0 );
};

const isInvalid = ( data, s = 'error', n = 1 ) => {
	let m;
	if ( s === 'error' ) {
		throw new RangeError( 'Missing error message' );
	} else if ( s !== 'warning' ) {
		m = s;
		s = 'error';
	}
	const result = lintJSON( data );
	expect( result ).toHaveLength( n );
	const [ { severity, message, position } ] = result;
	expect( severity ).toBe( s );
	if ( s === 'error' ) {
		const e = lintJSONNative( data );
		if ( e ) {
			expect( e ).toBe( position );
		}
	}
	if ( m ) {
		expect( message ).toBe( m );
	} else {
		expect( typeof message ).toBe( 'string' );
		expect( message.length ).toBeGreaterThan( 0 );
	}
	expect( position > 0 || message === 'Unexpected "/"' ).toBeTruthy();
};

describe( 'JSON Lint', () => {
	it( 'should report invalid JSON', () => {
		isInvalid( '["Unclosed array"', 'Expected "," or "]" instead of end of input' );
		isInvalid( '{unquoted_key: "keys must be quoted"}', 'Expected \'"\' instead of "u"' );
		isInvalid( '["extra comma",]', 'Trailing comma in array' );
		isInvalid( '["double extra comma",,]', 'Unexpected ","' );
		isInvalid( '[   , "<-- missing value"]', 'Unexpected ","' );
		isInvalid( '["Comma after the close"],', 'Syntax error' );
		isInvalid( '["Extra close"]]', 'Syntax error' );
		isInvalid( '{"Extra comma": true,}', 'Trailing comma in object' );
		isInvalid( '{"Extra value after close": true} "misplaced quoted value"', 'Syntax error' );
		isInvalid( '{"Illegal expression": 1 + 2}', 'Expected "," or "}" instead of "+"' );
		isInvalid( '{"Illegal invocation": alert()}', 'Unexpected "a"' );
		isInvalid( '{"Numbers cannot have leading zeroes": 013}', 'Bad number' );
		isInvalid( '{"Numbers cannot be hex": 0x14}', 'Expected "," or "}" instead of "x"' );
		isInvalid( String.raw`["Illegal backslash escape: \x15"]`, 'Bad escaped character' );
		isInvalid( String.raw`[\naked]`, String.raw`Unexpected "\\"` );
		isInvalid( String.raw`["Illegal backslash escape: \017"]`, 'Bad escaped character' );
		isInvalid( '{"Missing colon" null}', 'Expected ":" instead of "n"' );
		isInvalid( '{"Double colon":: null}', 'Unexpected ":"' );
		isInvalid( '{"Comma instead of colon", null}', 'Expected ":" instead of ","' );
		isInvalid( '["Colon instead of comma": false]', 'Expected "," or "]" instead of ":"' );
		isInvalid( '["Bad value", truth]', 'Expected "e" instead of "t"' );
		isInvalid( "['single quote']", 'Unexpected "\'"' );
		// eslint-disable-next-line no-tabs
		isInvalid( '["	tab	character	in	string	"]', 'Bad control character' );
		isInvalid( String.raw`["tab\   character\   in\  string\  "]`, 'Bad escaped character' );
		isInvalid( '["line\nbreak"]', 'Bad control character' );
		isInvalid(
			String.raw`["line\
break"]`,
			'Bad escaped character'
		);
		isInvalid( '[0e]', 'Bad number' );
		isInvalid( '[0e+]', 'Bad number' );
		isInvalid( '[0e+-1]', 'Bad number' );
		isInvalid( '{"Comma instead if closing brace": true,', 'Expected \'"\'' );
		isInvalid( '["mismatch"}', 'Expected "," or "]" instead of "}"' );
		isInvalid( '{"extra brace": 1}}', 'Syntax error' );
	} );
} );

describe( 'vscode-json-languageservice invalid cases', () => {
	it( 'Invalid body', () => {
		isInvalid( ' *', 'Unexpected "*"' );
		isInvalid( '{}[]', 'Syntax error' );
	} );

	it( 'Trailing Whitespace', () => {
		isValid( '{}\n\n' );
	} );

	it( 'No content', () => {
		isInvalid( '/*hello*/  ', 'Unexpected "/"' );
	} );

	it( 'Objects', () => {
		isValid( '{}' );
		isValid( '{"key": "value"}' );
		isValid( '{"key1": true, "key2": 3, "key3": [null], "key4": { "nested": {}}}' );
		isValid( '{"constructor": true }' );
		isInvalid( '{', 'Expected \'"\'' );
		isInvalid( '{3:3}', 'Expected \'"\' instead of "3"' );
		isInvalid( "{'key': 3}", 'Expected \'"\' instead of "\'"' );
		isInvalid( '{"key" 3}', 'Expected ":" instead of "3"' );
		isInvalid( '{"key":3 "key2": 4}', 'Expected "," or "}" instead of \'"\'' );
		isInvalid( '{"key":42, }', 'Trailing comma in object' );
		isInvalid( '{"key:42', 'Unterminated string' );
	} );

	it( 'Arrays', () => {
		isValid( '[]' );
		isValid( '[1, 2]' );
		isValid( '[1, "string", false, {}, [null]]' );
		isInvalid( '[', 'Unterminated array' );
		isInvalid( '[,]', 'Unexpected ","' );
		isInvalid( '[1 2]', 'Expected "," or "]" instead of "2"' );
		isInvalid( '[true false]', 'Expected "," or "]" instead of "f"' );
		isInvalid( '[1, ]', 'Trailing comma in array' );
		isInvalid( '[[]', 'Expected "," or "]" instead of end of input' );
		isInvalid( '["something"', 'Expected "," or "]" instead of end of input' );
		isInvalid( '[magic]', 'Unexpected "m"' );
	} );

	it( 'Strings', () => {
		isValid( '["string"]' );
		isValid( String.raw`["\"\\\/\b\f\n\r\t\u1234\u12AB"]` );
		isValid( String.raw`["\\"]` );
		isInvalid( '["', 'Unterminated string' );
		isInvalid( '["]', 'Unterminated string' );
		isInvalid( String.raw`["\z"]`, 'Bad escaped character' );
		isInvalid( String.raw`["\u"]`, 'Bad unicode escape' );
		isInvalid( String.raw`["\u123"]`, 'Bad unicode escape' );
		isInvalid( String.raw`["\u123Z"]`, 'Bad unicode escape' );
		isInvalid( "['string']", 'Unexpected "\'"' );
		isInvalid( '"\tabc"', 'Bad control character' );
	} );

	it( 'Numbers', () => {
		isValid( '[0, -1, 186.1, 0.123, -1.583e+4, 1.583E-4, 5e8]' );
		isInvalid( '[+1]', 'Unexpected "+"' );
		isInvalid( '[01]', 'Bad number' );
		isInvalid( '[1.]', 'Unterminated fractional number' );
		isInvalid( '[1.1+3]', 'Expected "," or "]" instead of "+"' );
		isInvalid( '[1.4e]', 'Bad number' );
		isInvalid( '[-A]', 'No number after minus sign' );
	} );

	it( 'Comments', () => {
		isInvalid( '/*d*/ { } /*e*/', 'Unexpected "/"' );
		isInvalid( '/*d { }', 'Unexpected "/"' );
		isInvalid( '{ "//": "comment1", "//": "comment2" }', 'warning' );
		isInvalid( '{ "regularKey": "value1", "regularKey": "value2" }', 'warning' );
	} );

	it( 'Simple AST', () => {
		isValid( '{}' );
		isValid( '[null]' );
		isValid( '{"a":true}' );
	} );

	it( 'Nested AST', () => {
		isValid( '{\n\t"key" : {\n\t"key2": 42\n\t}\n}' );
	} );

	it( 'Nested AST in Array', () => {
		isValid( '{"key":[{"key2":42}]}' );
	} );

	it( 'Multiline', () => {
		isValid( '{\n\t\n}' );
		isValid( '{\n"first":true\n\n}' );
	} );

	it( 'Expand errors to entire tokens', () => {
		isInvalid( '{\n"key":32,\nerror\n}', 'Expected \'"\' instead of "e"' );
	} );

	it( 'Errors at the end of the file', () => {
		isInvalid( '{\n"key":32\n ', 'Expected "," or "}" instead of end of input' );
	} );

	it( 'Getting keys out of an object', () => {
		isValid( '{\n"key":32,\n\n"key2":45}' );
	} );

	it( 'Missing colon', () => {
		isInvalid( '{\n"key":32,\n"key2"\n"key3": 4 }', 'Expected ":" instead of \'"\'' );
	} );

	it( 'Missing comma', () => {
		isInvalid( '{\n"key":32,\n"key2": 1 \n"key3": 4 }', 'Expected "," or "}" instead of \'"\'' );
	} );

	it( 'Duplicate keys', () => {
		isInvalid( '{"a": 1, "a": 2}', 'warning' );
		isInvalid( '{"a": { "a": 2, "a": 3}}', 'warning' );
		isInvalid( '[{ "a": 2, "a": 3, "a": 7}]', 'warning', 2 );
	} );

	it( 'Strings with spaces', () => {
		isValid( '{"key1":"first string", "key2":["second string"]}' );
	} );

	it( 'parse with comments', () => {
		isInvalid( '// comment\n{\n"far": "boo"\n}', 'Unexpected "/"' );
		isInvalid( '/* comm\nent\nent */\n{\n"far": "boo"\n}', 'Unexpected "/"' );
		isValid( '{\n"far": "boo"\n}' );
	} );

	it( 'parse with comments collected', () => {
		isInvalid( '// comment\n{\n"far": "boo"\n}', 'Unexpected "/"' );
		isInvalid( '/* comm\nent\nent */\n{\n"far": "boo"\n}', 'Unexpected "/"' );
		isValid( '{\n"far": "boo"\n}' );
	} );

	it( 'validate DocumentLanguageSettings: trailingCommas', () => {
		isInvalid( '{ "pages": [  "pages/index", "pages/log", ] }', 'Trailing comma in array' );
	} );

	it( 'validate DocumentLanguageSettings: comments', () => {
		isInvalid( '{ "count": 1 /* change */ }', 'Expected "," or "}" instead of "/"' );
	} );
} );
