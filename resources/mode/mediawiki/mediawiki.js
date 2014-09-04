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

CodeMirror.defineMode('mediawiki', function( config/*, parserConfig */ ) {

	var mustEat = true;
	var permittedHtmlTags = ['b', 'bdi', 'del', 'i', 'ins', 'u', 'font', 'big', 'small', 'sub', 'sup', 'h1',
				'h2', 'h3', 'h4', 'h5', 'h6', 'cite', 'code', 'em', 's',
				'strike', 'strong', 'tt', 'var', 'div', 'center',
				'blockquote', 'ol', 'ul', 'dl', 'table', 'caption', 'pre',
				'ruby', 'rb', 'rp', 'rt', 'rtc', 'p', 'span', 'abbr', 'dfn',
				'kbd', 'samp', 'data', 'time', 'mark', 'br', 'wbr', 'hr', 'li', 'dt', 'dd', 'td', 'th', 'tr'];

	function inWikitext( stream, state ) {
		function chain( parser ) {
			state.tokenize = parser;
			return parser( stream, state );
		}

		var style = [];
		var mnemonicStyle = []; // character entity references style
		var sol = stream.sol();
		var blockType = null, tmp, re, mt, name;
		if ( state.ImInBlock.length > 0 ) {
			blockType = state.ImInBlock[state.ImInBlock.length - 1];
		}

		switch ( blockType ) {
			case 'Link':
				if ( sol ) {
					state.ImInBlock.pop(); //FIXME: it is wrong Link
					return null;
				} else if ( stream.eatWhile( /[^#\s\u00a0\|\]\{\}\&]/ ) ) { //FIXME '{{' brokes Link, sample [[z{{page]]
					return 'attribute mw-underline';
				} else if ( stream.peek() === '&' ) { // check for character entity references
					style = ['attribute', 'mw-underline'];
					mnemonicStyle = ['mw-underline'];
				} else if ( stream.eat( '#' ) ) {
					state.ImInBlock.push( 'LinkToSection' );
					return 'attribute strong';
				} else if ( stream.eat( '|' ) ) {
					stream.eatSpace();
					state.ImInBlock.pop();
					state.ImInBlock.push( 'LinkText' );
					return 'attribute strong';
				} else if ( stream.eatSpace() ) {
					if ( /[^#\|\]]/.test( stream.peek() ) ) {
						return 'attribute mw-underline strong';
					}
					return null;
				} else if ( stream.match( ']]' ) ) {
					state.ImInBlock.pop();
//					if ( !stream.eatSpace() ) {
//						state.ImInBlock.push( 'LinkTrail' );
//					}
					return 'attribute';
				}
				break;
			case 'LinkToSection':
				if ( sol ) {
					state.ImInBlock.pop();
					state.ImInBlock.pop(); //FIXME: it is wrong Link
					return null;
				}
				if ( stream.eatWhile( /[^\|\]\{\}\&]/ ) ) { //FIXME '{{' brokes Link, sample [[z{{page]]
					mustEat = false;
					style = ['attribute'];
				} else if ( stream.peek() === '&' ) {
					style = ['attribute'];
				} else {
					state.ImInBlock.pop();
					return 'attribute';
				}
				break;
			case 'LinkText':
				stream.eatSpace();
				if ( stream.match( ']]' ) ) {
					state.ImInBlock.pop();
//					if ( !stream.eatSpace() ) {
//						state.ImInBlock.push( 'LinkTrail' );
//					}
					return 'attribute';
				}

				if ( stream.eatWhile( /[^\]\s\u00a0\&\}\[\]\{]/ ) ) {
					mustEat = false;
					style = ['mw-underline'];
				} else if ( stream.peek() === '&' ) {
					style = ['mw-underline'];
					mnemonicStyle = ['mw-underline'];
				}
				break;
//			case 'LinkTrail': // FIXME with Language::linkTrail()
//				state.ImInBlock.pop();
//				if ( sol !== true && stream.eatWhile( /[^\s\u00a0>\}\[\]<\{\']/ ) ) { // &
//					mustEat = false;
//					style.push( 'mw-underline' );
//				}
//				break;
			case 'TemplatePageName':
				if ( stream.match( /[\s\u00a0]*[^\s\u00a0\}\|<\{\&]/ ) ) {
					return 'attribute strong mw-underline';
				}
				if ( stream.eat( '|' ) ) {
					state.ImInBlock.pop();
					state.ImInBlock.push( 'TemplateArgument' );
					state.bTempArgName = true;
					stream.eatSpace();
					return 'attribute strong';
				}
				if ( stream.match( '}}' ) ) {
					state.ImInBlock.pop();
					return 'attribute';
				}
				if ( stream.peek() === '&' ) {
					style = ['attribute', 'strong', 'mw-underline'];
					mnemonicStyle = ['mw-underline'];
				} else if ( stream.match( /[\s\u00a0]*&/ ) ) { // {{ PAGE & NAME }}
					stream.backUp(1);
					return 'attribute strong mw-underline';
				}
				break;
			case 'TemplateArgument':
				if ( state.bTempArgName && stream.eatWhile( /[^=\[\]\}\|<\{\&]/ ) ) {
					state.bTempArgName = false;
					if ( stream.eat( '=' ) ) {
						return 'string strong';
					}
					return 'string';
				} else if ( stream.eatWhile( /[^\[\]\}\|<\{\&]/ ) ) {
					return 'string';
				} else if ( stream.eat( '|' ) ) {
					state.bTempArgName = true;
					return 'attribute strong';
				} else if ( stream.match( '}}' ) ) {
					state.ImInBlock.pop();
					return 'attribute';
				}
				style.push( 'string' );
				break;
			case 'TemplateVariable':
				if ( stream.eatWhile( /[^\}\[\]<\{\|\&]/ ) ) {
					return 'variable-2';
				}
				if ( stream.match( '}}}' ) ) {
					state.ImInBlock.pop();
					return 'variable-2';
				}
				style = ['variable-2'];
				break;
			case 'ParserFunctionName':
				if ( stream.match( /#?[^\s\u00a0\}\[\]<\{\'\|\&\:]+/ ) ) { // FIXME: {{#name}} and and {{uc}} are wrong, must have ':'
					return 'keyword strong';
				}
				if ( stream.eat( ':' ) ) {
					state.ImInBlock.pop();
					state.ImInBlock.push( 'ParserFunctionArgument' );
					return 'keyword strong';
				}
				if ( stream.match( /[\s\u00a0]*\}\}/ ) ) {
					state.ImInBlock.pop();
					return 'keyword';
				}
				style = ['keyword'];
				break;
			case 'ParserFunctionArgument':
				if ( stream.eatWhile( /[^\[\]\}\|<\{\&]/ ) ) {
					return 'string-2';
				} else if ( stream.eat( '|' ) ) {
					return 'keyword strong';
				} else if ( stream.match( '}}' ) ) {
					state.ImInBlock.pop();
					return 'keyword';
				}
				style.push( 'string-2' );
				break;
			case 'TagName':
				name = stream.match( /[^>\/\s\u00a0]*/ )[0].toLowerCase();
				state.ImInBlock.pop();
				state.ImInBlock.push( 'TagAttribute' );
				if ( config.mwextTags.indexOf( name ) >= 0 ) {
					state.ImInTag.push( name );
					return 'keyword';
				}
				state.ImInTag.push( null );
				return 'tag';
			case 'TagAttribute':
				var attributName = stream.eatWhile( /[^>\/\s\u00a0<\{\&]/ );
				if ( attributName ) {
					stream.eatSpace();
//					if ( stream.eat( '=' ) ) {
//						//state.tokenize = inTagAttributeValue( attributName );
//					}
					return 'attribute';
				}
				if ( stream.match( '/>') ) {
					state.ImInBlock.pop();
					return 'tag bracket';
				}
				if ( stream.eat( '>' ) ) {
					state.ImInBlock.pop();
					if ( state.ImInTag[ state.ImInTag.length - 1 ] ) {
						state.ImInBlock.push( 'InsideTag' );
					}
					return 'tag bracket';
				}
				break;
			case 'TagClose':
				state.ImInBlock.pop();
				name = stream.match( /[^>\/\s\u00a0]*/ );
				if ( name ) {
					name = name[0].toLowerCase();
					stream.eatSpace();
					if ( /[>]/.test( stream.peek() ) ) {
						state.ImInBlock.push( 'TagCloseEnd' );
					}
					return config.mwextTags.indexOf( name ) >= 0 ? 'keyword' : 'tag';
				}
				break;
			case 'TagCloseEnd':
				if ( stream.eat( '>' ) ) {
					state.ImInBlock.pop();
					state.ImInTag.pop();
					return 'tag bracket';
				}
				return 'error';
			case 'InsideTag':
				var tag = state.ImInTag[ state.ImInTag.length - 1 ];
				if ( tag === 'pre' || tag === 'nowiki' ) {
					var st = tag === 'pre' ? 'qualifier' : '';
					if ( stream.eatWhile( /[^&<]/ ) ) {
						return st;
					} else if ( stream.peek() === '&' ) {
						style = [st];
					} else {
						re = new RegExp( '</' + tag + '\\s*>', 'i' );
						mt = stream.match( re );
						if ( mt ) {
							stream.backUp( mt[0].length );
							state.ImInBlock.pop();
						} else {
							stream.next();
							return st;
						}
					}
				} else {
					if ( stream.eatWhile( /[^<]/ ) ) {
						return 'string-2';
					} else {
						re = new RegExp( '</' + tag + '\\s*>', 'i' );
						mt = stream.match( re );
						if ( mt ) {
							stream.backUp( mt[0].length );
							state.ImInBlock.pop();
						} else {
							stream.next();
							return 'string-2';
						}
					}
				}
				break;
			case null:
				if ( sol ) {
					state.isBold = false;
					state.isItalic = false;
					if ( stream.eat( ' ' ) ) {
						return 'mw-skipformatting';
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
				mnemonicStyle.push( 'atom' );
				return mnemonicStyle.join(' ');
			}
		} else {
			state.bTempArgName = false;
			switch ( ch ) {
				case '{':
					if ( stream.match( '{{' ) ) { // Variable
						stream.eatSpace();
						state.ImInBlock.push( 'TemplateVariable' );
						return 'variable-2';
					} else if ( stream.match( /\{[\s\u00a0]*/ ) ) {
						if ( stream.peek() === '#' ) { // Parser function
							state.ImInBlock.push( 'ParserFunctionName' );
							return 'keyword';
						}
						// Check for parser function without '#'
						name = stream.match( /([^\s\u00a0\}\[\]<\{\'\|\&\:]+)(\:|[\s\u00a0]*)(\}\}?)?(.)?/ );
						if ( name ) {
							stream.backUp( name[0].length );
							if ( (name[2] === ':' || name[4] === undefined || name[3] === '}}') && (config.mwextFunctionSynonyms[0][name[1].toLowerCase()] || config.mwextFunctionSynonyms[1][name[1]]) ) {
								state.ImInBlock.push( 'ParserFunctionName' );
								return 'keyword';
							}
						}
						// Template
						state.ImInBlock.push( 'TemplatePageName' );
						return 'attribute';
					}
					break;
				case '[':
					if ( stream.eat( '[' ) ) { // Link Example: [[ Foo | Bar ]]
						stream.eatSpace();
						if ( /[^\]\|\[\{]/.test( stream.peek() ) ) {
							state.ImInBlock.push( 'Link' );
							return 'attribute';
						}
					}
					break;
				case '<':
					if ( stream.match( '!--' ) ) {
						return chain( inBlock( 'comment', '-->' ) );
					}
					tmp = stream.eat( '/' ) ? 'TagClose' : 'TagName';
					name = stream.match( /[^>\/\s\u00a0]*/ );
					if ( name ) {
						stream.backUp( name[0].length );
						name = name[0].toLowerCase();
						if ( config.mwextTags.indexOf( name ) >= 0 || permittedHtmlTags.indexOf( name ) >= 0 ) {
							state.ImInBlock.push( tmp );
							return 'tag bracket';
						}
					}
					break;
				case '_':
					name = stream.match( /_[^\s\u00a0_>\}\[\]<\{\'\|\&\:]*__/ );
					if ( name ) {
						name = '_' + name[0];
						if ( config.mwextDoubleUnderscore[0][name.toLowerCase()] || config.mwextDoubleUnderscore[1][name] ) {
							return 'keyword strong';
						}
					}
					break;
			}
			stream.eatWhile( /[^\s\u00a0_>\}\[\]<\{\'\|\&\:]/ );
			if ( state.isBold ) {
				style.push( 'strong' );
			}
			if ( state.isItalic ) {
				style.push( 'em' );
			}
//			if ( state.skipFormatting ) {
//				style.push( 'mw-skipformatting' );
//			}
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
			return { tokenize: inWikitext, ImInBlock: [], ImInTag:[], skipFormatting: false, bTempArgName: false, isBold: false, isItalic: false };
		},
		token: function( stream, state ) {
			return state.tokenize( stream, state );
		}
	};
});

CodeMirror.defineMIME( 'text/mediawiki', 'mediawiki' );

});
