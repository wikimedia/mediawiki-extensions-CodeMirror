/*global CodeMirror, define, require  */
(function( mod ) {
	if ( typeof exports === 'object' && typeof module === 'object' ) { // CommonJS
		mod( require( '../../lib/codemirror' ), require( '../htmlmixed/htmlmixed' ) );
	} else if ( typeof define === 'function' && define.amd ) { // AMD
		define( ['../../lib/codemirror', '../htmlmixed/htmlmixed'], mod );
	} else { // Plain browser env
		mod( CodeMirror );
	}
})(function( CodeMirror ) {
'use strict';

CodeMirror.defineMode('mediawiki', function( /*config, parserConfig*/ ) {
	function inTemplatePageName( stream, state ) { // {{
		if ( stream.eat( '#' ) ) {
			state.tokenize = inParserFunctionName;
			return 'strong';
		}
		stream.eatWhile( /[^\|\}\s]/ );
		state.tokenize = inTemplateArgumentSeparator;
		return 'link';
	}

	function inTemplateArgumentSeparator( stream, state ) { // {{ Page name |
		if ( stream.eatSpace() && !stream.eol() ) {
			var peek = stream.peek();
			if ( peek !== '|' && peek !== '}' ) {
				state.tokenize = inTemplatePageName;
				return 'link';
			}
		}
		if ( stream.eat( '|' ) ) {
			state.tokenize = inTemplateArgument;
			return 'tag strong';
		}
		if ( stream.eat( '}' ) ) {
			if ( stream.eat( '}' ) ) {
				state.tokenize = inWikitext;
				return 'tag bracket';
			}
		}
		if ( stream.eol() ) {
			return null;
		}
		stream.next();
		return 'error';
	}

	function inTemplateArgument( stream, state ) { // {{ Page name |
		stream.eatWhile( /[^\|}]/ );
		state.tokenize = inTemplateArgumentSeparator;
		return 'string';
	}

	function inParserFunctionName( stream, state ) { // {{#
		if ( stream.eatWhile( /\w/ ) ) {
			if ( stream.peek() === ':' ) {
				state.tokenize = inParserFunctionArgumentSeparator;
				return 'keyword strong';
			}
		}
		state.tokenize = inWikitext;
		return 'error';
	}

	function inParserFunctionArgumentSeparator( stream, state ) { // {{ Page name |
		if ( stream.eat( /[|:]/ ) ) {
			state.tokenize = inParserFunctionArgument;
			return 'tag strong';
		}
		if ( stream.eat( '}' ) ) {
			if ( stream.eat( '}' ) ) {
				state.tokenize = inWikitext;
				return 'tag bracket';
			}
		}
		stream.next();
		return 'string';
	}

	function inParserFunctionArgument( stream, state ) { // {{#
		stream.eatWhile( /[^|}]/ );
		state.tokenize = inParserFunctionArgumentSeparator;
		return 'string';
	}

	function inWikitext( stream, state ) {
		var style = [];
		var sol = stream.sol();
		var ch = stream.next();

		if ( sol ) {
			state.isBold = false;
			state.isItalic = false;
		}

		switch ( ch ) {
			case '{':
				if ( stream.eat( '{' ) ) { // Templates
					state.tokenize = inTemplatePageName;
					stream.eatSpace();
					return 'tag bracket';
				}
				break;
			case '\'':
				if ( stream.match( '\'\'' ) ) {
					state.isBold = state.isBold ? false : true;
				} else if ( stream.match( '\'' ) ) {
					state.isItalic = state.isItalic ? false : true;
				}
				break;
			case '&':
				// this code was copied from mode/xml/xml.js
				var ok;
				if ( stream.eat( '#' ) ) {
					if (stream.eat( 'x' ) ) {
						ok = stream.eatWhile( /[a-fA-F\d]/ ) && stream.eat( ';');
					} else {
						ok = stream.eatWhile( /[\d]/ ) && stream.eat( ';' );
					}
				} else {
					ok = stream.eatWhile( /[\w\.\-:]/ ) && stream.eat( ';' );
				}
				if ( ok ) {
					style.push( 'atom' );
				}
				break;
		}

		if ( state.isBold ) {
			style.push( 'strong' );
		}
		if ( state.isItalic ) {
			style.push( 'em' );
		}
		if ( style.length > 0 ) {
			return style.join(' ');
		}
		return null;
	}

	return {
		startState: function() {
			return { tokenize: inWikitext, isBold: false, isItalic: false };
		},
		token: function( stream, state ) {
			return state.tokenize( stream, state );
		}
	};
});

CodeMirror.defineMIME( 'text/mediawiki', 'mediawiki' );

});
