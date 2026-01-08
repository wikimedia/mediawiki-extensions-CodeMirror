/*
	Original source (Public Domain):
		https://github.com/douglascrockford/JSON-js/blob/107fc93c94aa3a9c7b48548631593ecf3aac60d2/json_parse.js

	Modifications:
		- Only returns errors and warnings instead of the parsed value.
		- Better agreement with JSON specification.
		- Warnings for duplicate object keys and unsafe integers.
*/

/* eslint-disable no-throw-literal, no-unmodified-loop-condition */

module.exports = ( () => {

	// This is a function that can parse a JSON text.
	// It is a simple, recursive descent parser.
	// It does not use eval or regular expressions,
	// so it can be used as a model for implementing a JSON parser in other languages.

	// We are defining the function inside of another function to avoid creating global variables.

	let at; // The index of the current character
	let ch; // The current character
	const escapee = {
		'"': '"',
		'\\': '\\',
		'/': '/',
		b: '\b',
		f: '\f',
		n: '\n',
		r: '\r',
		t: '\t'
	};
	const spaces = new Set( [ ' ', '\t', '\n', '\r' ] );
	let text;
	let warnings;

	const stringify = ( c ) => {
		if ( c === '' ) {
			return 'end of input';
		}
		return c === '"' ? '\'"\'' : JSON.stringify( c );
	};

	const warn = ( m ) => {

		// Log warning when something is wrong.

		warnings.push( {
			message: m,
			position: at - 1,
			severity: 'warning'
		} );
	};

	const error = ( m ) => {

		// Call error when something is wrong.

		throw {
			warnings,
			message: m,
			position: at - 1,
			severity: 'error'
		};
	};

	const next = ( c ) => {

		// If a c parameter is provided, verify that it matches the current character.

		if ( c && c !== ch ) {
			error( `Expected ${ stringify( c ) } instead of ${ stringify( ch ) }` );
		}

		// Get the next character. When there are no more characters, return the empty string.

		ch = text.charAt( at );
		at += 1;
		return ch;
	};

	const number = () => {

		// Parse a number value.

		let val;
		let str = '';

		if ( ch === '-' ) {
			str = '-';
			next();
		}
		if ( ch === '0' ) {
			str += ch;
			next();
			if ( ch >= '0' && ch <= '9' ) {
				error( 'Bad number' );
			}
		} else if ( ch >= '1' && ch <= '9' ) {
			while ( ch >= '0' && ch <= '9' ) {
				str += ch;
				next();
			}
		} else {
			error( 'No number after minus sign' );
		}
		if ( ch !== '.' && ch !== 'e' && ch !== 'E' ) {
			val = Number( str );
			if ( !Number.isSafeInteger( val ) ) {
				warn( 'Not a safe integer' );
			}
		}
		if ( ch === '.' ) {
			str += '.';
			next();
			if ( ch < '0' || ch > '9' ) {
				error( 'Unterminated fractional number' );
			}
			while ( ch >= '0' && ch <= '9' ) {
				str += ch;
				next();
			}
		}
		if ( ch === 'e' || ch === 'E' ) {
			str += ch;
			next();
			// @ts-expect-error `ch` modified
			if ( ch === '-' || ch === '+' ) {
				str += ch;
				next();
			}
			while ( ch >= '0' && ch <= '9' ) {
				str += ch;
				next();
			}
		}
		if ( val === undefined ) {
			val = Number( str );
		}
		if ( !Number.isFinite( val ) ) {
			error( 'Bad number' );
		}
	};

	const string = () => {

		// Parse a string value.

		let hex;
		let i;
		let val = '';
		let uffff;

		// When parsing for string values, we must look for " and \ characters.

		if ( ch === '"' ) {
			while ( next() ) {
				if ( ch === '"' ) {
					next();
					return val;
				}
				if ( ch === '\\' ) {
					next();
					if ( ch === 'u' ) {
						uffff = 0;
						for ( i = 0; i < 4; i++ ) {
							hex = parseInt( next(), 16 );
							if ( !isFinite( hex ) ) {
								break;
							}
							uffff = uffff * 16 + hex;
						}
						if ( i < 4 ) {
							error( 'Bad unicode escape' );
						}
						val += String.fromCharCode( uffff );
					} else if ( typeof escapee[ ch ] === 'string' ) {
						val += escapee[ ch ];
					} else {
						error( 'Bad escaped character' );
					}
				} else if ( ch < ' ' ) {
					error( 'Bad control character' );
				} else {
					val += ch;
				}
			}
		} else {
			error( `Expected '"' instead of ${ JSON.stringify( ch ) }` );
		}
		return error( 'Unterminated string' );
	};

	const white = () => {

		// Skip whitespace.

		while ( ch && spaces.has( ch ) ) {
			next();
		}
	};

	const word = () => {

		// true, false, or null.

		switch ( ch ) {
			case 't':
				next();
				next( 'r' );
				next( 'u' );
				next( 'e' );
				return;
			case 'f':
				next();
				next( 'a' );
				next( 'l' );
				next( 's' );
				next( 'e' );
				return;
			case 'n':
				next();
				next( 'u' );
				next( 'l' );
				next( 'l' );
				return;
			default:
				error( `Unexpected ${ JSON.stringify( ch ) }` );
		}
	};

	const array = () => {

		// Parse an array value.

		next( '[' );
		white();
		if ( ch === ']' ) {
			next();
			return; // empty array
		}
		while ( ch ) {
			if ( ch === ']' ) {
				error( 'Trailing comma in array' );
			}
			// eslint-disable-next-line no-use-before-define
			value();
			white();
			if ( ch === ']' ) {
				next();
				return;
			} else if ( ch === ',' ) {
				next();
				white();
			} else {
				error( `Expected "," or "]" instead of ${ stringify( ch ) }` );
			}
		}
		error( 'Unterminated array' );
	};

	const object = () => {

		// Parse an object value.

		let key;
		const keys = new Set();

		next( '{' );
		white();
		if ( ch === '}' ) {
			next();
			return; // empty object
		}
		while ( ch ) {
			if ( ch === '}' ) {
				error( 'Trailing comma in object' );
			}
			key = string();
			white();
			next( ':' );
			if ( keys.has( key ) ) {
				warn( `Duplicate key ${ stringify( key ) }` );
			} else {
				keys.add( key );
			}
			// eslint-disable-next-line no-use-before-define
			value();
			white();
			if ( ch === '}' ) {
				next();
				return;
			} else if ( ch === ',' ) {
				next();
				white();
			} else {
				error( `Expected "," or "}" instead of ${ stringify( ch ) }` );
			}
		}
		error( 'Expected \'"\'' );
	};

	const value = () => {

		// Parse a JSON value. It could be an object, an array, a string, a number,
		// or a word.

		white();
		switch ( ch ) {
			case '{':
				return object();
			case '[':
				return array();
			case '"':
				return string();
			case '-':
				return number();
			default:
				return ch >= '0' && ch <= '9' ?
					number() :
					word();
		}
	};

	// Return the json_parse function. It will have access to all of the above
	// functions and variables.

	return ( source ) => {
		text = source;
		warnings = [];
		at = 0;
		ch = ' ';
		value();
		white();
		if ( ch ) {
			error( 'Syntax error' );
		} else if ( warnings.length > 0 ) {
			throw { warnings };
		}
	};
} )();
