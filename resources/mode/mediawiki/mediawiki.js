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
				'kbd', 'samp', 'data', 'time', 'mark', 'br', 'wbr', 'hr', 'li', 'dt', 'dd', 'td', 'th', 'tr',
				'noinclude', 'includeonly', 'onlyinclude'];

	function inWikitext( stream, state ) {
		function chain( parser ) {
			state.tokenize = parser;
			return parser( stream, state );
		}

		var style = [];
		var mnemonicStyle = []; // character entity references style
		var sol = stream.sol();
		var blockType = null, ch = null,  tmp, re, mt, name;
		if ( state.ImInBlock.length > 0 ) {
			blockType = state.ImInBlock[state.ImInBlock.length - 1];
		}

		switch ( blockType ) {
			case 'Section':
				if ( stream.eatWhile( /[^&<\[\{]/ ) ) {
					if ( stream.eol() ) {
						state.ImInBlock.pop();
						state.ImInBlock.push( 'SectionEnd' );
						stream.backUp( state.SectionN );
					}
					return null;
				}
				break;
			case 'SectionEnd':
				state.ImInBlock.pop();
				stream.skipToEnd();
				return 'mw-section-heading';
			case 'Link':
				if ( sol ) {
					state.ImInBlock.pop(); //FIXME: it is wrong Link
					return null;
				} else if ( stream.eatWhile( /[^#\s\u00a0\|\]\{\}\&]/ ) ) { //FIXME '{{' brokes Link, sample [[z{{page]]
					return 'mw-link-pagename mw-underline';
				} else if ( stream.peek() === '&' ) { // check for character entity references
					style = ['mw-link', 'mw-underline'];
					mnemonicStyle = ['mw-underline'];
				} else if ( stream.eat( '#' ) ) {
					state.ImInBlock.push( 'LinkToSection' );
					return 'mw-link';
				} else if ( stream.eat( '|' ) ) {
					stream.eatSpace();
					state.ImInBlock.pop();
					state.ImInBlock.push( 'LinkText' );
					return 'mw-link-delimiter';
				} else if ( stream.eatSpace() ) {
					if ( /[^#\|\]]/.test( stream.peek() ) ) {
						return 'mw-link-pagename mw-underline';
					}
					return null;
				} else if ( stream.match( ']]' ) ) {
					state.ImInBlock.pop();
//					if ( !stream.eatSpace() ) {
//						state.ImInBlock.push( 'LinkTrail' );
//					}
					return 'mw-link-bracket';
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
					style = ['mw-link-tosection'];
				} else if ( stream.peek() === '&' ) {
					style = ['mw-link-tosection'];
				} else {
					state.ImInBlock.pop();
					return 'mw-link-tosection';
				}
				break;
			case 'LinkText':
				stream.eatSpace();
				if ( stream.match( ']]' ) ) {
					state.ImInBlock.pop();
//					if ( !stream.eatSpace() ) {
//						state.ImInBlock.push( 'LinkTrail' );
//					}
					return 'mw-link-bracket';
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
			case 'ExternalLinkProtocol':
				while ( state.ProtocolN > 0 ) {
					state.ProtocolN--;
					stream.next();
				}
				state.ImInBlock.pop();
				if ( !stream.eol() ) {
					state.ImInBlock.push( 'ExternalLink' );
				}
				return 'mw-extlink-protocol mw-underline';
			case 'ExternalLink':
				if ( stream.eatWhile( /[^\s\]]/ ) ) {
					if ( stream.eol() ) {
						state.ImInBlock.pop();
					}
					return 'mw-extlink mw-underline';
				}
				state.ImInBlock.pop();
				if ( stream.eat( ']' ) ) {
					return 'mw-extlink-bracket';
				}
				stream.eatSpace();
				if ( !stream.eol() ) {
					state.ImInBlock.push( 'ExternalLinkText' );
				}
				return null;
			case 'ExternalLinkText':
				stream.eatSpace();
				if ( stream.eatWhile( /[^\]\s\u00a0]/ ) ) {
					if ( stream.eol() ) {
						state.ImInBlock.pop();
					}
					return 'mw-extlink-text mw-underline';
				}
				state.ImInBlock.pop();
				if ( stream.eat( ']' ) ) {
					return 'mw-extlink-bracket';
				}
				return null;
			case 'TemplatePageName':
				if ( stream.match( /[\s\u00a0]*[^\s\u00a0\}\|<\{\&]/ ) ) {
					return 'mw-templatepage-name';
				}
				if ( stream.eat( '|' ) ) {
					state.ImInBlock.pop();
					state.ImInBlock.push( 'TemplateArgument' );
					state.bTempArgName = true;
					stream.eatSpace();
					return 'mw-templatepage-delimiter';
				}
				if ( stream.match( '}}' ) ) {
					state.ImInBlock.pop();
					return 'mw-templatepage-bracket';
				}
				if ( stream.peek() === '&' ) {
					style = ['mw-templatepage-name'];
					mnemonicStyle = ['mw-templatepage-name-mnemonic'];
				} else if ( stream.match( /[\s\u00a0]*&/ ) ) { // {{ PAGE & NAME }}
					stream.backUp(1);
					return 'mw-templatepage-name';
				}
				break;
			case 'TemplateArgument':
				if ( state.bTempArgName && stream.eatWhile( /[^=\[\]\}\|<\{\&]/ ) ) {
					state.bTempArgName = false;
					if ( stream.eat( '=' ) ) {
						return 'mw-templatepage-argument-name';
					}
					return 'mw-templatepage';
				} else if ( stream.eatWhile( /[^\[\]\}\|<\{\&]/ ) ) {
					return 'mw-templatepage';
				} else if ( stream.eat( '|' ) ) {
					state.bTempArgName = true;
					return 'mw-templatepage-delimiter';
				} else if ( stream.match( '}}' ) ) {
					state.ImInBlock.pop();
					return 'mw-templatepage-bracket';
				}
				style.push( 'mw-templatepage' );
				break;
			case 'TemplateVariable':
				if ( stream.eatWhile( /[^\}\[\]<\{\|\&]/ ) ) {
					return 'mw-templatevariable-name';
				}
				if ( stream.eat('|') ) {
					state.ImInBlock.pop();
					state.ImInBlock.push( 'TemplateVariableDefault' );
					return 'mw-templatevariable-delimiter';
				}
				// break is not necessary here
				/*falls through*/
			case 'TemplateVariableDefault':
				if ( stream.match( '}}}' ) ) {
					state.ImInBlock.pop();
					return 'mw-templatevariable-bracket';
				}
				style = ['mw-templatevariable'];
				break;
			case 'ParserFunctionName':
				if ( stream.match( /#?[^\s\u00a0\}\[\]<\{\'\|\&\:]+/ ) ) { // FIXME: {{#name}} and and {{uc}} are wrong, must have ':'
					return 'mw-parserfunction-name';
				}
				if ( stream.eat( ':' ) ) {
					state.ImInBlock.pop();
					state.ImInBlock.push( 'ParserFunctionArgument' );
					return 'mw-parserfunction-delimiter';
				}
				if ( stream.match( /[\s\u00a0]*\}\}/ ) ) {
					state.ImInBlock.pop();
					return 'mw-parserfunction-bracket';
				}
				style = ['mw-parserfunction'];
				break;
			case 'ParserFunctionArgument':
				if ( stream.eatWhile( /[^\[\]\}\|<\{\&]/ ) ) {
					return 'mw-parserfunction';
				} else if ( stream.eat( '|' ) ) {
					return 'mw-parserfunction-delimiter';
				} else if ( stream.match( '}}' ) ) {
					state.ImInBlock.pop();
					return 'mw-parserfunction-bracket';
				}
				style.push( 'mw-parserfunction' );
				break;
			case 'TagName':
				name = stream.match( /[^>\/\|\s\u00a0]*/ )[0].toLowerCase();
				state.ImInBlock.pop();
				state.ImInBlock.push( 'TagAttribute' );
				if ( config.mwextTags.indexOf( name ) >= 0 ) {
					state.ImInTag.push( name );
					return 'mw-tagext-name';
				}
				state.ImInTag.push( null );
				return 'mw-tag-name';
			case 'TagAttribute':
				var attributName = stream.eatWhile( /[^>\/\s\u00a0<\{\&]/ );
				if ( attributName ) {
					stream.eatSpace();
//					if ( stream.eat( '=' ) ) {
//						//state.tokenize = inTagAttributeValue( attributName );
//					}
					return 'mw-tag-attribute';
				}
				if ( stream.match( '/>') ) {
					state.ImInBlock.pop();
					return 'mw-tag-bracket';
				}
				if ( stream.eat( '>' ) ) {
					state.ImInBlock.pop();
					if ( state.ImInTag[ state.ImInTag.length - 1 ] ) {
						state.ImInBlock.push( 'InsideTag' );
						return 'mw-tagext-bracket';
					}
					return 'mw-tag-bracket';
				}
				style = ['mw-tag-attribute'];
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
					return config.mwextTags.indexOf( name ) >= 0 ? 'mw-tagext-name' : 'mw-tag-name';
				}
				break;
			case 'TagCloseEnd':
				if ( stream.eat( '>' ) ) {
					state.ImInBlock.pop();
					if ( state.ImInTag.pop() ) {
						return 'mw-tagext-bracket';
					}
					return 'mw-tag-bracket';
				}
				return 'error';
			case 'InsideTag':
				var tag = state.ImInTag[ state.ImInTag.length - 1 ];
				if ( tag === 'pre' || tag === 'nowiki' ) {
					var st = tag === 'pre' ? 'mw-tag-pre' : 'mw-tag-nowiki';
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
						return 'mw-tagext';
					} else {
						re = new RegExp( '</' + tag + '\\s*>', 'i' );
						mt = stream.match( re );
						if ( mt ) {
							stream.backUp( mt[0].length );
							state.ImInBlock.pop();
						} else {
							stream.next();
							return 'mw-tagext';
						}
					}
				}
				break;
			case null:
				if ( stream.peek() === '\'' ) {
					if ( stream.match( '\'\'\'' ) ) {
						state.isBold = state.isBold ? false : true;
						return null;
					} else if ( stream.match( '\'\'' ) ) {
						state.isItalic = state.isItalic ? false : true;
						return null;
					}
				}
				if ( sol ) {
					state.isBold = false;
					state.isItalic = false;
					mustEat = false;
					ch = stream.next();
					switch ( ch ) {
						case ' ':
							return 'mw-skipformatting';
						case '*':
						case '#':
							if ( stream.match( /[\*#]*:*/ ) ) {
								return 'mw-list';
							}
							break;
						case ':':
							if ( stream.match( /:*[\*#]*/ ) ) {
								return 'mw-indenting';
							}
							break;
						case '=':
							tmp = stream.match( /(={0,5})(.+?(=\1\s*))$/ );
							if ( tmp ) { // Title
								stream.backUp( tmp[2].length );
								state.ImInBlock.push( 'Section' );
								state.SectionN = tmp[3].length;
								return 'mw-section-heading line-cm-mw-section-' + (tmp[1].length + 1);
							}
							break;
					}
				}
		}

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
				mnemonicStyle.push( 'mw-mnemonic' );
				return mnemonicStyle.join(' ');
			}
		} else {
			state.bTempArgName = false;
			switch ( ch ) {
				case '{':
					if ( stream.match( '{{' ) ) { // Variable
						stream.eatSpace();
						state.ImInBlock.push( 'TemplateVariable' );
						return 'mw-templatevariable-bracket';
					} else if ( stream.match( /\{[\s\u00a0]*/ ) ) {
						if ( stream.peek() === '#' ) { // Parser function
							state.ImInBlock.push( 'ParserFunctionName' );
							return 'mw-parserfunction-bracket';
						}
						// Check for parser function without '#'
						name = stream.match( /([^\s\u00a0\}\[\]<\{\'\|\&\:]+)(\:|[\s\u00a0]*)(\}\}?)?(.)?/ );
						if ( name ) {
							stream.backUp( name[0].length );
							if ( (name[2] === ':' || name[4] === undefined || name[3] === '}}') && (name[1].toLowerCase() in config.mwextFunctionSynonyms[0] || name[1] in config.mwextFunctionSynonyms[1]) ) {
								state.ImInBlock.push( 'ParserFunctionName' );
								return 'mw-parserfunction-bracket';
							}
						}
						// Template
						state.ImInBlock.push( 'TemplatePageName' );
						return 'mw-templatepage-bracket';
					}
					break;
				case '[':
					if ( stream.eat( '[' ) ) { // Link Example: [[ Foo | Bar ]]
						stream.eatSpace();
						if ( /[^\]\|\[\{]/.test( stream.peek() ) ) {
							state.ImInBlock.push( 'Link' );
							return 'mw-link-bracket';
						}
					} else {
						re = new RegExp( config.mwextUrlProtocols, 'i' );
						mt = stream.match( re );
						if ( mt ) {
							stream.backUp( mt[0].length );
							state.ProtocolN = mt[0].length;
							state.ImInBlock.push( 'ExternalLinkProtocol' );
							return 'mw-extlink-bracket';
						}
					}
					break;
				case '<':
					if ( stream.match( '!--' ) ) { // coment
						return chain( inBlock( 'mw-comment', '-->' ) );
					}
					tmp = stream.eat( '/' ) ? 'TagClose' : 'TagName';
					name = stream.match( /[^>\/\s\u00a0]*/ );
					if ( name ) {
						stream.backUp( name[0].length );
						name = name[0].toLowerCase();
						if ( config.mwextTags.indexOf( name ) >= 0 ) { // Parser function
							state.ImInBlock.push( tmp );
							return 'mw-tagext-bracket';
						}
						if ( permittedHtmlTags.indexOf( name ) >= 0 ) { // Html tag
							state.ImInBlock.push( tmp );
							return 'mw-tag-bracket';
						}
					}
					break;
				case '_':
					name = stream.match( /_[^\s\u00a0_>\}\[\]<\{\'\|\&\:]*__/ );
					if ( name ) {
						name = '_' + name[0];
						if ( name.toLowerCase() in config.mwextDoubleUnderscore[0] || name in config.mwextDoubleUnderscore[1] ) {
							return 'mw-parserfunction-name';
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
			return { tokenize: inWikitext, ImInBlock: [], ImInTag:[], skipFormatting: false, bTempArgName: false, isBold: false, isItalic: false, SectionN: null, ProtocolN: null };
		},
		token: function( stream, state ) {
			return state.tokenize( stream, state );
		}
	};
});

CodeMirror.defineMIME( 'text/mediawiki', 'mediawiki' );

});
