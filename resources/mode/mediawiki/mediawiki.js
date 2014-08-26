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

	var tagName = false;
	var mustEat = true;

	function inWikitext( stream, state ) {
		function chain( parser ) {
			state.tokenize = parser;
			return parser( stream, state );
		}

		var style = [];
		var sol = stream.sol();
		var blockType = null;
		if ( state.ImInBlock.length > 0 ) {
			blockType = state.ImInBlock[state.ImInBlock.length - 1];
		}

		switch ( blockType ) {
			case 'Link':
				if ( sol ) {
					state.ImInBlock.pop(); //FIXME: it is wrong Link
					return null;
				} else if ( stream.eatWhile( /[^#\s\u00a0\|\]]/ ) ) { //FIXME '{{' brokes Link, sample [[z{{page]]
					return 'attribute mw-underline strong';
				} else if ( stream.eat( '#' ) ) {
					state.ImInBlock.push( 'LinkToSection' );
					return 'attribute strong';
				} else if ( stream.eat( '|' ) ) {
					stream.eatSpace();
					state.ImInBlock.pop();
					state.ImInBlock.push( 'LinkText' );
					return 'tag strong';
				} else if ( stream.eatSpace() ) {
					if ( /[^#\|\]]/.test( stream.peek() ) ) {
						return 'attribute mw-underline strong';
					}
					return null;
				} else if ( stream.eat( ']' ) ) {
					if ( stream.eat( ']' ) ) {
						state.ImInBlock.pop();
						if ( !stream.eatSpace() ) {
							state.ImInBlock.push( 'LinkTrail' );
						}
						return 'tag bracket';
					}
				}
				break;
			case 'LinkToSection':
				state.ImInBlock.pop();
				if ( sol ) {
					state.ImInBlock.pop(); //FIXME: it is wrong Link
					return null;
				}
				stream.eatWhile( /[^\|\]]/ ); //FIXME '{{' brokes Link, sample [[z{{page]]
				return 'attribute';
			case 'LinkText':
				stream.eatSpace();
				if ( stream.match( /[\s\u00a0]*\]\]/ ) ) {
					state.ImInBlock.pop();
					if ( !stream.eatSpace() ) {
						state.ImInBlock.push( 'LinkTrail' );
					}
					return 'tag bracket';
				}
				mustEat = false;
				stream.eatWhile( /[^\]\s\u00a0]/ );
				style.push( 'mw-underline' );
				break;
			case 'LinkTrail': // FIXME with Language::linkTrail()
				state.ImInBlock.pop();
				if ( !stream.sol && stream.eatWhile( /[^\s\u00a0>\}\[\]<\{\']/ ) ) { // &
					mustEat = false;
					style.push( 'mw-underline' );
				}
				break;
			case 'TemplatePageName':
				state.ImInBlock.pop();
				if ( stream.eat( '#' ) ) {
					state.ImInBlock.push( 'ParserFunctionName' );
					return 'keyword strong';
				} else {
					if ( stream.eatWhile( /[^\s\u00a0\}\|<\{\&]/ ) ) {
						state.ImInBlock.push( 'TemplatePageNameContinue' );
						return 'attribute mw-underline';
					}
				}
				break;
			case 'TemplatePageNameContinue':
				stream.eatSpace();
				if ( stream.match( /[\s\u00a0]*[^\s\u00a0\}\|<\{\&]/ ) ) {
					return 'attribute mw-underline';
				}
				if ( stream.eat( '|' ) ) {
					state.ImInBlock.pop();
					state.ImInBlock.push( 'TemplateArgument' );
					state.bTempArgName = true;
					stream.eatSpace();
					return 'tag strong';
				}
				if ( stream.match( /\}\}/ ) ) {
					state.ImInBlock.pop();
					return 'tag bracket';
				}
				break;
			case 'TemplateArgument':
				if ( state.bTempArgName && stream.eatWhile( /[^=\}\|<\{\&]/ ) ) {
					state.bTempArgName = false;
					if ( stream.eat( '=' ) ) {
						return 'string strong';
					}
					return 'string';
				} else if ( stream.eatWhile( /[^\}\|<\{\&]/ ) ) {
					return 'string';
				} else if ( stream.eat( '|' ) ) {
					state.bTempArgName = true;
					return 'tag strong';
				} else if ( stream.eat( '}' ) ) {
					if ( stream.eat( '}' ) ) {
						state.ImInBlock.pop();
						return 'tag bracket';
					}
				}
				style.push( 'string' );
				break;
			case 'ParserFunctionName':
				if ( stream.eatWhile( /\w/ ) ) {
					return 'keyword strong';
				}
				if ( stream.eat( ':' ) ) {
					state.ImInBlock.pop();
					state.ImInBlock.push( 'ParserFunctionArgument' );
					return 'keyword strong';
				}
				break;
			case 'ParserFunctionArgument':
				if ( stream.eatWhile( /[^\}\|<\{\&]/ ) ) {
					return 'string-2';
				} else if ( stream.eat( '|' ) ) {
					return 'tag strong';
				} else if ( stream.eat( '}' ) ) {
					if ( stream.eat( '}' ) ) {
						state.ImInBlock.pop();
						return 'tag bracket';
					}
				}
				style.push( 'string-2' );
				break;
			case 'TagName':
				var tmp = stream.eatWhile( /[^>\/\s\u00a0<\{\&]/ );
				if ( tmp ) {
					if ( stream.eatSpace() || /[>\/\s\u00a0]/.test( stream.peek() ) ) {
						state.ImInBlock.pop();
						state.ImInBlock.push( 'TagAttribute' );
						state.ImInTag.push( tagName === true ? tmp : null );
					}
					tagName = false;
					return 'tag';
				}
				tagName = false;
				break;
			case 'TagAttribute':
				var attributName = stream.eatWhile( /[^>\/\s\u00a0<\{\&]/ );
				if ( attributName ) {
					stream.eatSpace();
//					if ( stream.eat( '=' ) ) {
//						//state.tokenize = inTagAttributeValue( attributName );
//					}
					return 'attribute';
				}
				if ( stream.eat( '>' ) ) {
					state.ImInBlock.pop();
					return 'tag bracket';
				}
				break;
			case 'TagClose':
				if ( stream.eatWhile( /[^>\/\s\u00a0<\{\&]/ ) ) {
					stream.eatSpace();
					if ( /[^<\{\&]/.test( stream.peek() ) ) {
						state.ImInBlock.pop();
						state.ImInBlock.push( 'TagCloseEnd' );
					}
					return 'tag';
				}
				break;
			case 'TagCloseEnd':
				if ( stream.eat( '>' ) ) {
					state.ImInBlock.pop();
					return 'tag bracket';
				}
				return 'error';
			case null:
				if ( sol ) {
					state.isBold = false;
					state.isItalic = false;
					if ( stream.eat( ' ' ) ) {
						state.allowWikiformatting = false;
					} else {
						state.allowWikiformatting = true;
					}
				}
				if ( stream.peek() === '\'' ) {
					if ( stream.match( '\'\'\'' ) ) {
						state.isBold = state.isBold ? false : true;
						return null;
					} else if ( stream.match( '\'\'' ) ) {
						state.isItalic = state.isItalic ? false : true;
						return null;
					}
				}
		}

		var ch = null;
		if ( mustEat ) {
			ch = stream.next();
		} else {
			mustEat = true;
		}

		if ( ch === '&' ) {
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
				return 'atom';
			}
		} else if ( state.allowWikimarkup ) {
			state.bTempArgName = false;
			switch ( ch ) {
				case '{':
					if ( stream.eat( '{' ) ) { // Templates
						stream.eatSpace();
						state.ImInBlock.push( 'TemplatePageName' );
						return 'tag bracket';
					}
					break;
				case '[':
					if ( stream.eat( '[' ) ) { // Link Example: [[ Foo | Bar ]]
						stream.eatSpace();
						if ( /[^\]\|\[\{]/.test( stream.peek() ) ) {
							state.ImInBlock.push( 'Link' );
							return 'tag bracket';
						}
					}
					break;
				case '<':
					if ( stream.match( '!--' ) ) {
						return chain( inBlock( 'comment', '-->' ) );
					}
					if ( stream.eat( '/' ) ) {
						if ( /[\w\{<]/.test( stream.peek() ) ) {
							if ( state.ImInBlock.length > 0 && state.ImInBlock[state.ImInBlock.length -1] === 'TagName' ) { // <nowiki><</nowiki>
								state.ImInBlock.pop();
							}
							state.ImInBlock.push( 'TagClose' );
							return 'tag bracket';
						}
					} else if ( /[\w\{<]/.test( stream.peek() ) ) {
						tagName = true;
						state.ImInBlock.push( 'TagName' );
						return 'tag bracket';
					}
					break;
			}
			stream.eatWhile( /[^\s\u00a0>\}\[\]<\{\'\&]/ );
			if ( state.isBold ) {
				style.push( 'strong' );
			}
			if ( state.isItalic ) {
				style.push( 'em' );
			}
			if ( !state.allowWikiformatting ) {
				style.push( 'qualifier' );
			}
		} else {
			stream.eatWhile( /[^&]/ );
			style.push( 'qualifier' );
		}

		if ( style.length > 0 ) {
			return style.join(' ');
		}
		return null;
	}

	function inBlock( style, terminator ) {
		return function( stream, state ) {
			while ( !stream.eol() ) {
				if ( stream.match( terminator ) ) {
					state.tokenize = inWikitext;
					break;
				}
				stream.next();
			}
			return style;
		};
	}

	return {
		startState: function() {
			return { tokenize: inWikitext, ImInBlock: [], ImInTag:[], allowWikimarkup: true, allowWikiformatting: true, bTempArgName: false, isBold: false, isItalic: false };
		},
		token: function( stream, state ) {
			return state.tokenize( stream, state );
		}
	};
});

CodeMirror.defineMIME( 'text/mediawiki', 'mediawiki' );

});
