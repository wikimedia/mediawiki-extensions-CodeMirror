"use strict";var t=require("ext.CodeMirror.v6.lib"),e=new WeakMap;function a(){return{em:"mw-em",error:"mw-error",extNowiki:"mw-ext-nowiki",extPre:"mw-ext-pre",extTag:"mw-exttag",extTagAttribute:"mw-exttag-attribute",extTagBracket:"mw-exttag-bracket",extTagName:"mw-exttag-name",freeExtLink:"mw-free-extlink",freeExtLinkProtocol:"mw-free-extlink-protocol",htmlEntity:"mw-html-entity",link:"mw-link",linkPageName:"mw-link-pagename",nowiki:"mw-tag-nowiki",pageName:"mw-pagename",pre:"mw-tag-pre",section:"mw-section",skipFormatting:"mw-skipformatting",strong:"mw-strong",tableCaption:"mw-table-caption",templateVariableDelimiter:"mw-templatevariable-delimiter"}}var i=new(function(){function i(){t._classCallCheck(this,i),t._classPrivateFieldInitSpec(this,e,{get:a,set:void 0}),this.extHighlightStyles=[],this.tokenTable=this.defaultTokenTable}return t._createClass(i,[{key:"addTag",value:function(t){var e=arguments.length>1&&void 0!==arguments[1]?arguments[1]:null;this.tokenTable["mw-tag-".concat(t)]||(this.addToken("mw-tag-".concat(t),e),this.addToken("mw-ext-".concat(t),e))}},{key:"addToken",value:function(e){var a=arguments.length>1&&void 0!==arguments[1]?arguments[1]:null;this.tokenTable[e]||(this.tokenTable[e]=t.Tag.define(a),this.extHighlightStyles.push({tag:this.tokenTable[e],class:"cm-".concat(e)}))}},{key:"permittedHtmlTags",get:function(){return{b:!0,bdi:!0,del:!0,i:!0,ins:!0,u:!0,font:!0,big:!0,small:!0,sub:!0,sup:!0,h1:!0,h2:!0,h3:!0,h4:!0,h5:!0,h6:!0,cite:!0,code:!0,em:!0,s:!0,strike:!0,strong:!0,tt:!0,var:!0,div:!0,center:!0,blockquote:!0,q:!0,ol:!0,ul:!0,dl:!0,table:!0,caption:!0,pre:!0,ruby:!0,rb:!0,rp:!0,rt:!0,rtc:!0,p:!0,span:!0,abbr:!0,dfn:!0,kbd:!0,samp:!0,data:!0,time:!0,mark:!0,br:!0,wbr:!0,hr:!0,li:!0,dt:!0,dd:!0,td:!0,th:!0,tr:!0,noinclude:!0,includeonly:!0,onlyinclude:!0}}},{key:"implicitlyClosedHtmlTags",get:function(){return{br:!0,hr:!0,wbr:!0}}},{key:"tags",get:function(){return t._objectSpread2({apostrophes:"character",apostrophesBold:"strong",apostrophesItalic:"emphasis",comment:"comment",doubleUnderscore:"controlKeyword",extLink:"url",extLinkBracket:"modifier",extLinkProtocol:"namespace",extLinkText:"labelName",hr:"contentSeparator",htmlTagAttribute:"attributeName",htmlTagBracket:"angleBracket",htmlTagName:"tagName",indenting:"operatorKeyword",linkBracket:"squareBracket",linkDelimiter:"operator",linkText:"string",linkToSection:"className",list:"list",parserFunction:"unit",parserFunctionBracket:"paren",parserFunctionDelimiter:"punctuation",parserFunctionName:"keyword",sectionHeader:"heading",sectionHeader1:"heading1",sectionHeader2:"heading2",sectionHeader3:"heading3",sectionHeader4:"heading4",sectionHeader5:"heading5",sectionHeader6:"heading6",signature:"quote",tableBracket:"null",tableDefinition:"definitionOperator",tableDelimiter:"typeOperator",template:"attributeValue",templateArgumentName:"definitionKeyword",templateBracket:"bracket",templateDelimiter:"separator",templateName:"moduleKeyword",templateVariable:"atom",templateVariableBracket:"brace",templateVariableName:"variableName"},t._classPrivateFieldGet(this,e))}},{key:"defaultTokenTable",get:function(){var e;return e={},t._defineProperty(t._defineProperty(t._defineProperty(t._defineProperty(t._defineProperty(t._defineProperty(t._defineProperty(t._defineProperty(t._defineProperty(t._defineProperty(e,this.tags.em,t.Tag.define()),this.tags.error,t.Tag.define()),this.tags.extNowiki,t.Tag.define()),this.tags.extPre,t.Tag.define()),this.tags.extTag,t.Tag.define()),this.tags.extTagAttribute,t.Tag.define()),this.tags.extTagBracket,t.Tag.define()),this.tags.extTagName,t.Tag.define()),this.tags.freeExtLink,t.Tag.define()),this.tags.freeExtLinkProtocol,t.Tag.define()),t._defineProperty(t._defineProperty(t._defineProperty(t._defineProperty(t._defineProperty(t._defineProperty(t._defineProperty(t._defineProperty(t._defineProperty(t._defineProperty(e,this.tags.htmlEntity,t.Tag.define()),this.tags.link,t.Tag.define()),this.tags.linkPageName,t.Tag.define()),this.tags.nowiki,t.Tag.define()),this.tags.pageName,t.Tag.define()),this.tags.pre,t.Tag.define()),this.tags.section,t.Tag.define()),this.tags.skipFormatting,t.Tag.define()),this.tags.strong,t.Tag.define()),this.tags.tableCaption,t.Tag.define()),t._defineProperty(e,this.tags.templateVariableDelimiter,t.Tag.define())}},{key:"getTagStyles",value:function(e){return[{tag:t.tags[this.tags.apostrophes],class:"cm-mw-apostrophes"},{tag:t.tags[this.tags.apostrophesBold],class:"cm-mw-apostrophes-bold"},{tag:t.tags[this.tags.apostrophesItalic],class:"cm-mw-apostrophes-italic"},{tag:t.tags[this.tags.comment],class:"cm-mw-comment"},{tag:t.tags[this.tags.doubleUnderscore],class:"cm-mw-double-underscore"},{tag:t.tags[this.tags.extLink],class:"cm-mw-extlink"},{tag:t.tags[this.tags.extLinkBracket],class:"cm-mw-extlink-bracket"},{tag:t.tags[this.tags.extLinkProtocol],class:"cm-mw-extlink-protocol"},{tag:t.tags[this.tags.extLinkText],class:"cm-mw-extlink-text"},{tag:t.tags[this.tags.hr],class:"cm-mw-hr"},{tag:t.tags[this.tags.htmlTagAttribute],class:"cm-mw-htmltag-attribute"},{tag:t.tags[this.tags.htmlTagBracket],class:"cm-mw-htmltag-bracket"},{tag:t.tags[this.tags.htmlTagName],class:"cm-mw-htmltag-name"},{tag:t.tags[this.tags.indenting],class:"cm-mw-indenting"},{tag:t.tags[this.tags.linkBracket],class:"cm-mw-link-bracket"},{tag:t.tags[this.tags.linkDelimiter],class:"cm-mw-link-delimiter"},{tag:t.tags[this.tags.linkText],class:"cm-mw-link-text"},{tag:t.tags[this.tags.linkToSection],class:"cm-mw-link-tosection"},{tag:t.tags[this.tags.list],class:"cm-mw-list"},{tag:t.tags[this.tags.parserFunction],class:"cm-mw-parserfunction"},{tag:t.tags[this.tags.parserFunctionBracket],class:"cm-mw-parserfunction-bracket"},{tag:t.tags[this.tags.parserFunctionDelimiter],class:"cm-mw-parserfunction-delimiter"},{tag:t.tags[this.tags.parserFunctionName],class:"cm-mw-parserfunction-name"},{tag:t.tags[this.tags.sectionHeader],class:"cm-mw-section-header"},{tag:t.tags[this.tags.sectionHeader1],class:"cm-mw-section-1"},{tag:t.tags[this.tags.sectionHeader2],class:"cm-mw-section-2"},{tag:t.tags[this.tags.sectionHeader3],class:"cm-mw-section-3"},{tag:t.tags[this.tags.sectionHeader4],class:"cm-mw-section-4"},{tag:t.tags[this.tags.sectionHeader5],class:"cm-mw-section-5"},{tag:t.tags[this.tags.sectionHeader6],class:"cm-mw-section-6"},{tag:t.tags[this.tags.signature],class:"cm-mw-signature"},{tag:t.tags[this.tags.tableBracket],class:"cm-mw-table-bracket"},{tag:t.tags[this.tags.tableDefinition],class:"cm-mw-table-definition"},{tag:t.tags[this.tags.tableDelimiter],class:"cm-mw-table-delimiter"},{tag:t.tags[this.tags.template],class:"cm-mw-template"},{tag:t.tags[this.tags.templateArgumentName],class:"cm-mw-template-argument-name"},{tag:t.tags[this.tags.templateBracket],class:"cm-mw-template-bracket"},{tag:t.tags[this.tags.templateDelimiter],class:"cm-mw-template-delimiter"},{tag:t.tags[this.tags.templateName],class:"cm-mw-pagename cm-mw-template-name"},{tag:t.tags[this.tags.templateVariable],class:"cm-mw-templatevariable"},{tag:t.tags[this.tags.templateVariableBracket],class:"cm-mw-templatevariable-bracket"},{tag:t.tags[this.tags.templateVariableName],class:"cm-mw-templatevariable-name"},{tag:e.tokenTable[this.tags.em],class:"cm-mw-em"},{tag:e.tokenTable[this.tags.error],class:"cm-mw-error"},{tag:e.tokenTable[this.tags.extNowiki],class:"cm-mw-ext-nowiki"},{tag:e.tokenTable[this.tags.extPre],class:"cm-mw-ext-pre"},{tag:e.tokenTable[this.tags.extTagBracket],class:"cm-mw-exttag-bracket"},{tag:e.tokenTable[this.tags.extTag],class:"cm-mw-exttag"},{tag:e.tokenTable[this.tags.extTagAttribute],class:"cm-mw-exttag-attribute"},{tag:e.tokenTable[this.tags.extTagName],class:"cm-mw-exttag-name"},{tag:e.tokenTable[this.tags.freeExtLink],class:"cm-mw-free-extlink"},{tag:e.tokenTable[this.tags.freeExtLinkProtocol],class:"cm-mw-free-extlink-protocol"},{tag:e.tokenTable[this.tags.htmlEntity],class:"cm-mw-html-entity"},{tag:e.tokenTable[this.tags.linkPageName],class:"cm-mw-link-pagename"},{tag:e.tokenTable[this.tags.nowiki],class:"cm-mw-tag-nowiki"},{tag:e.tokenTable[this.tags.pageName],class:"cm-mw-pagename"},{tag:e.tokenTable[this.tags.pre],class:"cm-mw-tag-pre"},{tag:e.tokenTable[this.tags.section],class:"cm-mw-section"},{tag:e.tokenTable[this.tags.skipFormatting],class:"cm-mw-skipformatting"},{tag:e.tokenTable[this.tags.strong],class:"cm-mw-strong"},{tag:e.tokenTable[this.tags.tableCaption],class:"cm-mw-table-caption"},{tag:e.tokenTable[this.tags.templateVariableDelimiter],class:"cm-mw-templatevariable-delimiter"}].concat(t._toConsumableArray(this.extHighlightStyles))}}]),i}()),n=function(t){return t.name.split("_").includes(i.tags.templateBracket)},s=function(t){return t.name.split("_").includes(i.tags.templateDelimiter)},r=function(t){return/\x2Dtemplate[\x2D0-9a-z]+ground/.test(t.name)&&!n(t)},o=function(t,e){return"{"===t.sliceDoc(e.from,e.from+1)?1:-1},l=function(e,a,i){if("number"==typeof a&&(i=t.ensureSyntaxTree(e,a)),!i)return null;var l;if("number"==typeof a?(l=i.resolve(a,-1),r(l)||(l=i.resolve(a,1))):l=a,!r(l))return null;for(var c=l,m=c.prevSibling,g=c.nextSibling,k=1,u=s(l)?l:null;g;){if(n(g)){if(0===(k+=o(e,g)))break}else!u&&1===k&&s(g)&&(u=g);g=g.nextSibling}if(!g)return null;for(k=-1;m;){if(n(m)){if(0===(k+=o(e,m)))break}else-1===k&&s(m)&&(u=m);m=m.prevSibling}var h=u&&u.to,p=g.from;return h&&h<p?{from:h,to:p}:null},c=function(e){var a=e.selection.main.head,i=l(e,a);if(i){var n=i.from,s=i.to,r=!1;return t.foldedRanges(e).between(n,s,(function(t,e){t===n&&e===s&&(r=!0)})),r?null:{pos:a,above:!0,create:function(e){var a=document.createElement("div");return a.className="cm-tooltip-fold",a.textContent="－",a.title=mw.msg("codemirror-fold-template"),a.onclick=function(){e.dispatch({effects:t.foldEffect.of({from:n,to:s}),selection:{anchor:s}}),a.remove()},{dom:a}}}}return null},m=[{key:"Ctrl-Shift-[",mac:"Cmd-Alt-[",run:function(e){var a=e.state,i=t.ensureSyntaxTree(a,e.viewport.to);if(!i)return!1;var n,s=[],o=a.selection.ranges,c=Math.max.apply(Math,t._toConsumableArray(o.map((function(t){return t.to})))),m=t._createForOfIteratorHelper(o);try{for(m.s();!(n=m.n()).done;){var g=n.value,k=g.from,u=g.to,h=void 0;for(k===u&&(h=i.resolve(k,-1)),h&&r(h)||(h=i.resolve(k,1));h&&h.from<=u;){var p=l(a,h,i);p?(s.push(t.foldEffect.of(p)),h=i.resolve(p.to,1),c=Math.max(c,p.to)):h=h.nextSibling}}}catch(t){m.e(t)}finally{m.f()}if(s.length>0){var f=e.dom.querySelector(".cm-tooltip-fold");return f&&f.remove(),e.dispatch({effects:s,selection:{anchor:c}}),!0}return!1}},{key:"Ctrl-Shift-]",mac:"Cmd-Alt-]",run:function(e){var a,i=e.state,n=i.selection,s=[],r=t.foldedRanges(i),o=t._createForOfIteratorHelper(n.ranges);try{for(o.s();!(a=o.n()).done;){var l=a.value,c=l.from,m=l.to;r.between(c,m,(function(e,a){s.push(t.unfoldEffect.of({from:e,to:a}))}))}}catch(t){o.e(t)}finally{o.f()}return s.length>0&&(e.dispatch({effects:s,selection:n}),!0)}},{key:"Ctrl-Alt-[",run:function(e){for(var a=e.state,i=t.syntaxTree(a),n=[],s=Math.max.apply(Math,t._toConsumableArray(a.selection.ranges.map((function(t){return t.to})))),r=i.topNode.firstChild;r;){var o=l(a,r,i);if(o){n.push(t.foldEffect.of(o));var c=o.from,m=o.to;r=i.resolve(m,1),c<=s&&m>s&&(s=m)}else r=r.nextSibling}if(n.length>0){var g=e.dom.querySelector(".cm-tooltip-fold");return g&&g.remove(),e.dispatch({effects:n,selection:{anchor:s}}),!0}return!1}},{key:"Ctrl-Alt-]",run:t.unfoldAll}],g=[t.codeFolding({placeholderDOM:function(e){var a=document.createElement("span");return a.textContent="…",a.setAttribute("aria-label",mw.msg("codemirror-folded-code")),a.title=mw.msg("codemirror-unfold"),a.className="cm-foldPlaceholder",a.onclick=function(a){var i=a.target,n=e.posAtDOM(i),s=e.state,r=s.selection;t.foldedRanges(s).between(n,n,(function(a,i){a===n&&e.dispatch({effects:t.unfoldEffect.of({from:a,to:i}),selection:r})}))},a}}),t.StateField.define({create:c,update:function(t,e){var a=e.state,i=e.docChanged,n=e.selection;return i||n?c(a):t},provide:function(e){return t.showTooltip.from(e)}}),t.keymap.of(m)],k=t.Decoration.mark({class:"cm-bidi-isolate",bidiIsolate:t.Direction.LTR});function u(e){var a,n=new t.RangeSetBuilder,s=t._createForOfIteratorHelper(e.visibleRanges);try{var r=function(){var s,r=a.value,o=r.from,l=r.to;t.syntaxTree(e.state).iterate({from:o,to:l,enter:function(t){var e=t.name.split("_").some((function(t){return[i.tags.htmlTagBracket,i.tags.extTagBracket].includes(t)}));!s&&e?s=t.from:e&&(n.add(s,t.to,k),s=null)}})};for(s.s();!(a=s.n()).done;)r()}catch(t){s.e(t)}finally{s.f()}return n.finish()}var h=function(){function e(a){t._classCallCheck(this,e),this.isolates=u(a),this.tree=t.syntaxTree(a.state)}return t._createClass(e,[{key:"update",value:function(e){(e.docChanged||e.viewportChanged||t.syntaxTree(e.state)!==this.tree)&&(this.isolates=u(e.view),this.tree=t.syntaxTree(e.state))}}]),e}(),p={provide:function(e){var a=function(a){return a.plugin(e)&&a.plugin(e).isolates||t.Decoration.none};return t.Prec.lowest([t.EditorView.decorations.of(a),t.EditorView.bidiIsolatedRanges.of(a)])}},f=t.ViewPlugin.fromClass(h,p),d=function(){function e(a){t._classCallCheck(this,e),this.config=a,this.urlProtocols=new RegExp("^(?:".concat(this.config.urlProtocols,")(?=[^\\s {[\\]<>~).,'])"),"i"),this.isBold=!1,this.wasBold=!1,this.isItalic=!1,this.wasItalic=!1,this.firstSingleLetterWord=null,this.firstMultiLetterWord=null,this.firstSpace=null,this.oldStyle=null,this.tokens=[],this.oldTokens=[],this.tokenTable=i.tokenTable,this.registerGroundTokens(),Object.keys(this.config.tags).forEach((function(t){return i.addTag(t)}))}return t._createClass(e,[{key:"registerGroundTokens",value:function(){["mw-ext-ground","mw-ext-link-ground","mw-ext2-ground","mw-ext2-link-ground","mw-ext3-ground","mw-ext3-link-ground","mw-link-ground","mw-template-ext-ground","mw-template-ext-link-ground","mw-template-ext2-ground","mw-template-ext2-link-ground","mw-template-ext3-ground","mw-template-ext3-link-ground","mw-template-ground","mw-template-link-ground","mw-template2-ext-ground","mw-template2-ext-link-ground","mw-template2-ext2-ground","mw-template2-ext2-link-ground","mw-template2-ext3-ground","mw-template2-ext3-link-ground","mw-template2-ground","mw-template2-link-ground","mw-template3-ext-ground","mw-template3-ext-link-ground","mw-template3-ext2-ground","mw-template3-ext2-link-ground","mw-template3-ext3-ground","mw-template3-ext3-link-ground","mw-template3-ground","mw-template3-link-ground"].forEach((function(t){return i.addToken(t)}))}},{key:"eatHtmlEntity",value:function(t,e){return(t.eat("#")?t.eat("x")?t.eatWhile(/[a-fA-F\d]/)&&t.eat(";"):t.eatWhile(/[\d]/)&&t.eat(";"):t.eatWhile(/[\w.\-:]/)&&t.eat(";"))?i.tags.htmlEntity:e}},{key:"makeStyle",value:function(t,e,a){return this.isBold&&(t+=" "+i.tags.strong),this.isItalic&&(t+=" "+i.tags.em),this.makeLocalStyle(t,e,a)}},{key:"makeLocalStyle",value:function(t,e,a){var i="";switch(e.nTemplate){case 0:break;case 1:i+="-template";break;case 2:i+="-template2";break;default:i+="-template3"}switch(e.nExt){case 0:break;case 1:i+="-ext";break;case 2:i+="-ext2";break;default:i+="-ext3"}return e.nLink>0&&(i+="-link"),""!==i&&(t="mw".concat(i,"-ground ").concat(t)),a&&e[a]--,t.trim()}},{key:"eatBlock",value:function(t,e,a){var i=this;return function(n,s){return n.skipTo(e)?(!1!==a&&n.match(e),s.tokenize=s.stack.pop()):n.skipToEnd(),i.makeLocalStyle(t,s)}}},{key:"eatEnd",value:function(t){var e=this;return function(a,i){return a.skipToEnd(),i.tokenize=i.stack.pop(),e.makeLocalStyle(t,i)}}},{key:"eatChar",value:function(t,e){var a=this;return function(n,s){return s.tokenize=s.stack.pop(),n.eat(t)?a.makeLocalStyle(e,s):a.makeLocalStyle(i.tags.error,s)}}},{key:"eatSectionHeader",value:function(t){var e=this;return function(a,n){return a.match(/^[^&<[{~]+/)?(a.eol()?(a.backUp(t),n.tokenize=e.eatEnd(i.tags.sectionHeader)):a.match(/^<!--(?!.*?-->.*?=)/,!1)&&(a.backUp(t),n.tokenize=e.eatBlock(i.tags.sectionHeader,"\x3c!--",!1)),i.tags.section):e.eatWikiText(i.tags.section)(a,n)}}},{key:"inVariable",value:function(t,e){return t.match(/^[^{}|]+/)?this.makeLocalStyle(i.tags.templateVariableName,e):t.eat("|")?(e.tokenize=this.inVariableDefault.bind(this),this.makeLocalStyle(i.tags.templateVariableDelimiter,e)):t.match("}}}")?(e.tokenize=e.stack.pop(),this.makeLocalStyle(i.tags.templateVariableBracket,e)):t.match("{{{")?(e.stack.push(e.tokenize),this.makeLocalStyle(i.tags.templateVariableBracket,e)):(t.next(),this.makeLocalStyle(i.tags.templateVariableName,e))}},{key:"inVariableDefault",value:function(t,e){return t.match(/^[^{}[<&~]+/)?this.makeLocalStyle(i.tags.templateVariable,e):t.match("}}}")?(e.tokenize=e.stack.pop(),this.makeLocalStyle(i.tags.templateVariableBracket,e)):this.eatWikiText(i.tags.templateVariable)(t,e)}},{key:"inParserFunctionName",value:function(t,e){return t.match(/^#?[^:}{~]+/)?this.makeLocalStyle(i.tags.parserFunctionName,e):t.eat(":")?(e.tokenize=this.inParserFunctionArguments.bind(this),this.makeLocalStyle(i.tags.parserFunctionDelimiter,e)):t.match("}}")?(e.tokenize=e.stack.pop(),this.makeLocalStyle(i.tags.parserFunctionBracket,e,"nExt")):this.eatWikiText(i.tags.parserFunction)(t,e)}},{key:"inParserFunctionArguments",value:function(t,e){return t.match(/^[^|}{[<&~]+/)?this.makeLocalStyle(i.tags.parserFunction,e):t.eat("|")?this.makeLocalStyle(i.tags.parserFunctionDelimiter,e):t.match("}}")?(e.tokenize=e.stack.pop(),this.makeLocalStyle(i.tags.parserFunctionBracket,e,"nExt")):this.eatWikiText(i.tags.parserFunction)(t,e)}},{key:"eatTemplatePageName",value:function(t){var e=this;return function(a,n){return a.match(/^[\s\u00a0]*\|[\s\u00a0]*/)?(n.tokenize=e.eatTemplateArgument(!0),e.makeLocalStyle(i.tags.templateDelimiter,n)):a.match(/^[\s\u00a0]*\}\}/)?(n.tokenize=n.stack.pop(),e.makeLocalStyle(i.tags.templateBracket,n,"nTemplate")):a.match(/^[\s\u00a0]*<!--.*?-->/)?e.makeLocalStyle(i.tags.comment,n):t&&a.sol()?(n.nTemplate--,void(n.tokenize=n.stack.pop())):a.match(/^[\s\u00a0]*[^\s\u00a0|}<{&~]+/)?(n.tokenize=e.eatTemplatePageName(!0),e.makeLocalStyle(i.tags.templateName,n)):a.eatSpace()?(a.eol(),e.makeLocalStyle(i.tags.templateName,n)):e.eatWikiText(i.tags.templateName)(a,n)}}},{key:"eatTemplateArgument",value:function(t){var e=this;return function(a,n){return t&&a.eatWhile(/[^=|}{[<&~]/)?a.eat("=")?(n.tokenize=e.eatTemplateArgument(!1),e.makeLocalStyle(i.tags.templateArgumentName,n)):e.makeLocalStyle(i.tags.template,n):a.eatWhile(/[^|}{[<&~]/)?e.makeLocalStyle(i.tags.template,n):a.eat("|")?(n.tokenize=e.eatTemplateArgument(!0),e.makeLocalStyle(i.tags.templateDelimiter,n)):a.match("}}")?(n.tokenize=n.stack.pop(),e.makeLocalStyle(i.tags.templateBracket,n,"nTemplate")):e.eatWikiText(i.tags.template)(a,n)}}},{key:"eatExternalLinkProtocol",value:function(t){var e=this;return function(a,n){for(;t>0;)t--,a.next();return a.eol()?(n.nLink--,n.tokenize=n.stack.pop()):n.tokenize=e.inExternalLink.bind(e),e.makeLocalStyle(i.tags.extLinkProtocol,n)}}},{key:"inExternalLink",value:function(t,e){return t.sol()?(e.nLink--,void(e.tokenize=e.stack.pop())):t.match(/^[\s\u00a0]*\]/)?(e.tokenize=e.stack.pop(),this.makeLocalStyle(i.tags.extLinkBracket,e,"nLink")):t.eatSpace()?(e.tokenize=this.inExternalLinkText.bind(this),this.makeStyle("",e)):t.match(/^[^\s\u00a0\]{&~']+/)||t.eatSpace()?("'"===t.peek()&&(t.match("''",!1)?e.tokenize=this.inExternalLinkText.bind(this):t.next()),this.makeStyle(i.tags.extLink,e)):this.eatWikiText(i.tags.extLink)(t,e)}},{key:"inExternalLinkText",value:function(t,e){return t.sol()?(e.nLink--,void(e.tokenize=e.stack.pop())):t.eat("]")?(e.tokenize=e.stack.pop(),this.makeLocalStyle(i.tags.extLinkBracket,e,"nLink")):t.match(/^[^'\]{&~<]+/)?this.makeStyle(i.tags.extLinkText,e):this.eatWikiText(i.tags.extLinkText)(t,e)}},{key:"inLink",value:function(t,e){return t.sol()?(e.nLink--,void(e.tokenize=e.stack.pop())):t.match(/^[\s\u00a0]*#[\s\u00a0]*/)?(e.tokenize=this.inLinkToSection.bind(this),this.makeLocalStyle(i.tags.link,e)):t.match(/^[\s\u00a0]*\|[\s\u00a0]*/)?(e.tokenize=this.eatLinkText(),this.makeLocalStyle(i.tags.linkDelimiter,e)):t.match(/^[\s\u00a0]*\]\]/)?(e.tokenize=e.stack.pop(),this.makeLocalStyle(i.tags.linkBracket,e,"nLink")):t.match(/^[\s\u00a0]*[^\s\u00a0#|\]&~{]+/)||t.eatSpace()?this.makeStyle("".concat(i.tags.linkPageName," ").concat(i.tags.pageName),e):this.eatWikiText("".concat(i.tags.linkPageName," ").concat(i.tags.pageName))(t,e)}},{key:"inLinkToSection",value:function(t,e){return t.sol()?(e.nLink--,void(e.tokenize=e.stack.pop())):t.match(/^[^|\]&~{}]+/)?this.makeLocalStyle(i.tags.linkToSection,e):t.eat("|")?(e.tokenize=this.eatLinkText(),this.makeLocalStyle(i.tags.linkDelimiter,e)):t.match("]]")?(e.tokenize=e.stack.pop(),this.makeLocalStyle(i.tags.linkBracket,e,"nLink")):this.eatWikiText(i.tags.linkToSection)(t,e)}},{key:"eatLinkText",value:function(){var t,e,a=this;return function(n,s){var r;return n.match("]]")?(s.tokenize=s.stack.pop(),a.makeLocalStyle(i.tags.linkBracket,s,"nLink")):n.match("'''")?(t=!t,a.makeLocalStyle("".concat(i.tags.linkText," ").concat(i.tags.apostrophes),s)):n.match("''")?(e=!e,a.makeLocalStyle("".concat(i.tags.linkText," ").concat(i.tags.apostrophes),s)):(r=i.tags.linkText,t&&(r+=" "+i.tags.strong),e&&(r+=" "+i.tags.em),n.match(/^[^'\]{&~<]+/)?a.makeStyle(r,s):a.eatWikiText(r)(n,s))}}},{key:"eatTagName",value:function(t,e,a){var n=this;return function(s,r){for(var o="";t>0;)t--,o+=s.next();return s.eatSpace(),o=o.toLowerCase(),a?(e&&!i.implicitlyClosedHtmlTags[o]?r.tokenize=n.eatChar(">",i.tags.htmlTagBracket):r.tokenize=n.eatHtmlTagAttribute(o),n.makeLocalStyle(i.tags.htmlTagName,r)):(r.tokenize=e?n.eatChar(">","".concat(i.tags.extTagBracket," mw-ext-").concat(o)):n.eatExtTagAttribute(o),n.makeLocalStyle("".concat(i.tags.extTagName," mw-ext-").concat(o),r))}}},{key:"eatHtmlTagAttribute",value:function(t){var e=this;return function(a,n){return a.match(/^(?:"[^<">]*"|'[^<'>]*'|[^>/<{&~])+/)?e.makeLocalStyle(i.tags.htmlTagAttribute,n):a.eat(">")?(t in i.implicitlyClosedHtmlTags||n.inHtmlTag.push(t),n.tokenize=n.stack.pop(),e.makeLocalStyle(i.tags.htmlTagBracket,n)):a.match("/>")?(n.tokenize=n.stack.pop(),e.makeLocalStyle(i.tags.htmlTagBracket,n)):e.eatWikiText(i.tags.htmlTagAttribute)(a,n)}}},{key:"eatNowiki",value:function(){var t=this;return function(e){return e.match(/^[^&]+/)?"":(e.next(),t.eatHtmlEntity(e,""))}}},{key:"eatExtTagAttribute",value:function(t){var e=this;return function(a,n){if(a.match(/^(?:"[^">]*"|'[^'>]*'|[^>/<{&~])+/))return e.makeLocalStyle("".concat(i.tags.extTagAttribute," mw-ext-").concat(t),n);if(a.eat(">")){if(n.extName=t,"nowiki"===t||"pre"===t)n.extMode={startState:function(){},copyState:function(){},token:e.eatNowiki()};else if(t in e.config.tagModes){var s=e.config.tagModes[t];"mediawiki"!==s&&"text/mediawiki"!==s||(n.extMode=e.mediawiki,n.extState=n.extMode.startState())}return n.tokenize=e.eatExtTagArea(t),e.makeLocalStyle("".concat(i.tags.extTagBracket," mw-ext-").concat(t),n)}return a.match("/>")?(n.tokenize=n.stack.pop(),e.makeLocalStyle("".concat(i.tags.extTagBracket," mw-ext-").concat(t),n)):e.eatWikiText("".concat(i.tags.extTagAttribute," mw-ext-").concat(t))(a,n)}}},{key:"eatExtTagArea",value:function(t){var e=this;return function(a,i){var n,s=a.pos,r=new RegExp("</".concat(t,"\\s*>"),"i").exec(s?a.string.slice(s):a.string),o=!1;if(r){if(0===r.index)return i.tokenize=e.eatExtCloseTag(t),i.extName=!1,!1!==i.extMode&&(i.extMode=!1,i.extState=!1),i.tokenize(a,i);n=r.index+s,o=a.string,a.string=o.slice(0,n)}return i.stack.push(i.tokenize),i.tokenize=e.eatExtTokens(o),i.tokenize(a,i)}}},{key:"eatExtCloseTag",value:function(t){var e=this;return function(a,n){return a.next(),a.next(),n.tokenize=e.eatTagName(t.length,!0,!1),e.makeLocalStyle("".concat(i.tags.extTagBracket," mw-ext-").concat(t),n)}}},{key:"eatExtTokens",value:function(t){var e=this;return function(a,n){var s;return!1===n.extMode?(s=i.tags.extTag,a.skipToEnd()):s="mw-tag-".concat(n.extName," ")+n.extMode.token(a,n.extState,!1===t),a.eol()&&(!1!==t&&(a.string=t),n.tokenize=n.stack.pop()),e.makeLocalStyle(s,n)}}},{key:"eatStartTable",value:function(t,e){return t.match("{|"),t.eatSpace(),e.tokenize=this.inTableDefinition.bind(this),i.tags.tableBracket}},{key:"inTableDefinition",value:function(t,e){return t.sol()?(e.tokenize=this.inTable.bind(this),this.inTable(t,e)):this.eatWikiText(i.tags.tableDefinition)(t,e)}},{key:"inTable",value:function(t,e){if(t.sol()){if(t.eatSpace(),t.eat("|"))return t.eat("-")?(t.eatSpace(),e.tokenize=this.inTableDefinition.bind(this),this.makeLocalStyle(i.tags.tableDelimiter,e)):t.eat("+")?(t.eatSpace(),e.tokenize=this.eatTableRow(!0,!1,!0),this.makeLocalStyle(i.tags.tableDelimiter,e)):t.eat("}")?(e.tokenize=e.stack.pop(),this.makeLocalStyle(i.tags.tableBracket,e)):(t.eatSpace(),e.tokenize=this.eatTableRow(!0,!1),this.makeLocalStyle(i.tags.tableDelimiter,e));if(t.eat("!"))return t.eatSpace(),e.tokenize=this.eatTableRow(!0,!0),this.makeLocalStyle(i.tags.tableDelimiter,e)}return this.eatWikiText("")(t,e)}},{key:"eatTableRow",value:function(t,e,a){var n=this,s="";return a?s=i.tags.tableCaption:e&&(s=i.tags.strong),function(r,o){if(r.sol()){if(r.match(/^[\s\u00a0]*[|!]/,!1))return o.tokenize=n.inTable.bind(n),n.inTable(r,o)}else{if(r.match(/^[^'|{[<&~!]+/))return n.makeStyle(s,o);if(r.match("||")||e&&r.match("!!"))return n.isBold=!1,n.isItalic=!1,o.tokenize=n.eatTableRow(!0,e,a),n.makeLocalStyle(i.tags.tableDelimiter,o);if(t&&r.eat("|"))return o.tokenize=n.eatTableRow(!1,e,a),n.makeLocalStyle(i.tags.tableDelimiter,o)}return n.eatWikiText(s)(r,o)}}},{key:"eatFreeExternalLinkProtocol",value:function(t,e){return t.match(this.urlProtocols),e.tokenize=this.eatFreeExternalLink.bind(this),this.makeLocalStyle(i.tags.freeExtLinkProtocol,e)}},{key:"eatFreeExternalLink",value:function(t,e){if(t.eol());else if(t.match(/^[^\s\u00a0{[\]<>~).,']*/))if("~"===t.peek()){if(!t.match(/^~~~+/,!1))return t.match(/^~*/),this.makeLocalStyle(i.tags.freeExtLink,e)}else if("{"===t.peek()){if(!t.match("{{",!1))return t.next(),this.makeLocalStyle(i.tags.freeExtLink,e)}else if("'"===t.peek()){if(!t.match("''",!1))return t.next(),this.makeLocalStyle(i.tags.freeExtLink,e)}else if(t.match(/^[).,]+(?=[^\s\u00a0{[\]<>~).,])/))return this.makeLocalStyle(i.tags.freeExtLink,e);return e.tokenize=e.stack.pop(),this.makeLocalStyle(i.tags.freeExtLink,e)}},{key:"eatWikiText",value:function(t){var e=this;return function(a,n){var s,r,o,l,c,m,g;if(a.sol()){if(!a.match("//",!1)&&a.match(e.urlProtocols))return n.stack.push(n.tokenize),n.tokenize=e.eatFreeExternalLink.bind(e),e.makeLocalStyle(i.tags.freeExtLinkProtocol,n);switch(s=a.next()){case"-":if(a.match(/^---+/))return i.tags.hr;break;case"=":if(r=a.match(/^(={0,5})(.+?(=\1\s*)(<!--(?!.*-->.*\S).*?)?)$/))return a.backUp(r[2].length),n.stack.push(n.tokenize),n.tokenize=e.eatSectionHeader(r[3].length),i.tags.sectionHeader+" "+i.tags["sectionHeader".concat(r[1].length+1)];break;case"*":case"#":case";":return a.match(/^[*#;:]*/),i.tags.list;case":":return a.match(/^:*{\|/,!1)&&(n.stack.push(n.tokenize),n.tokenize=e.eatStartTable.bind(e)),a.match(/^[*#;:]*/),i.tags.indenting;case" ":if(!a.match(/^[\s\u00a0]*:*{\|/,!1))return i.tags.skipFormatting;if(a.eatSpace(),a.match(/^:+/))return n.stack.push(n.tokenize),n.tokenize=e.eatStartTable.bind(e),i.tags.indenting;a.eat("{");case"{":if(a.eat("|"))return a.eatSpace(),n.stack.push(n.tokenize),n.tokenize=e.inTableDefinition.bind(e),i.tags.tableBracket}}else s=a.next();switch(s){case"&":return e.makeStyle(e.eatHtmlEntity(a,t),n);case"'":if(a.match(/^'*(?=''''')/)||a.match(/^'''(?!')/,!1))break;if(a.match("''"))return e.firstSingleLetterWord||a.match("''",!1)||e.prepareItalicForCorrection(a),e.isBold=!e.isBold,e.makeLocalStyle(i.tags.apostrophesBold,n);if(a.eat("'"))return e.isItalic=!e.isItalic,e.makeLocalStyle(i.tags.apostrophesItalic,n);break;case"[":if(a.eat("[")){if(a.eatSpace(),/[^\]|[]/.test(a.peek()))return n.nLink++,n.stack.push(n.tokenize),n.tokenize=e.inLink.bind(e),e.makeLocalStyle(i.tags.linkBracket,n)}else if(o=a.match(e.urlProtocols))return n.nLink++,a.backUp(o[0].length),n.stack.push(n.tokenize),n.tokenize=e.eatExternalLinkProtocol(o[0].length),e.makeLocalStyle(i.tags.extLinkBracket,n);break;case"{":if(a.match(/^{{(?!{|[^{}]*}}(?!}))/))return a.eatSpace(),n.stack.push(n.tokenize),n.tokenize=e.inVariable.bind(e),e.makeLocalStyle(i.tags.templateVariableBracket,n);if(a.match(/^{(?!{(?!{))[\s\u00a0]*/))return"#"===a.peek()?(n.nExt++,n.stack.push(n.tokenize),n.tokenize=e.inParserFunctionName.bind(e),e.makeLocalStyle(i.tags.parserFunctionBracket,n)):!(l=a.match(/^([^\s\u00a0}[\]<{'|&:]+)(:|[\s\u00a0]*)(\}\}?)?(.)?/))||(a.backUp(l[0].length),":"!==l[2]&&void 0!==l[4]&&"}}"!==l[3]||!(l[1].toLowerCase()in e.config.functionSynonyms[0])&&!(l[1]in e.config.functionSynonyms[1]))?(n.nTemplate++,n.stack.push(n.tokenize),n.tokenize=e.eatTemplatePageName(!1),e.makeLocalStyle(i.tags.templateBracket,n)):(n.nExt++,n.stack.push(n.tokenize),n.tokenize=e.inParserFunctionName.bind(e),e.makeLocalStyle(i.tags.parserFunctionBracket,n));break;case"<":if(c=!!a.eat("/"),m=a.match(/^[^>/\s\u00a0.*,[\]{}$^+?|/\\'`~<=!@#%&()-]+/),a.match("!--"))return g=e.eatBlock(i.tags.comment,"--\x3e"),n.stack.push(n.tokenize),n.tokenize=g,g(a,n);if(m){if((m=m[0].toLowerCase())in e.config.tags)return!0===c?i.tags.error:(a.backUp(m.length),n.stack.push(n.tokenize),n.tokenize=e.eatTagName(m.length,c,!1),e.makeLocalStyle("".concat(i.tags.extTagBracket," mw-ext-").concat(m),n));if(m in i.permittedHtmlTags)return!0===c&&m!==n.inHtmlTag.pop()?(a.pos++,i.tags.error):!0===c&&m in i.implicitlyClosedHtmlTags?i.tags.error:(a.backUp(m.length),n.stack.push(n.tokenize),n.tokenize=e.eatTagName(m.length,c||m in i.implicitlyClosedHtmlTags,!0),e.makeLocalStyle(i.tags.htmlTagBracket,n));a.backUp(m.length)}break;case"~":if(a.match(/^~{2,4}/))return i.tags.signature;break;case"_":for(r=1;a.eat("_");)r++;if(r>2)return a.eol()||a.backUp(2),e.makeStyle(t,n);if(2===r&&(l=a.match(/^([^\s\u00a0>}[\]<{'|&:~]+?)__/))&&l[0])return"__"+l[0].toLowerCase()in e.config.doubleUnderscore[0]||"__"+l[0]in e.config.doubleUnderscore[1]?i.tags.doubleUnderscore:(a.eol()||a.backUp(2),e.makeStyle(t,n));break;default:if(/[\s\u00a0]/.test(s)&&(a.eatSpace(),a.match(e.urlProtocols,!1)&&!a.match("//")))return n.stack.push(n.tokenize),n.tokenize=e.eatFreeExternalLinkProtocol.bind(e),e.makeStyle(t,n)}return a.match(/^[^\s\u00a0_>}[\]<{'|&:~=]+/),e.makeStyle(t,n)}}},{key:"prepareItalicForCorrection",value:function(t){var e=t.pos,a=t.string.slice(0,e-3),i=a.slice(-1),n=a.slice(-2,-1);if(" "===i){if(this.firstMultiLetterWord||this.firstSpace)return;this.firstSpace=e}else if(" "===n)this.firstSingleLetterWord=e;else{if(this.firstMultiLetterWord)return;this.firstMultiLetterWord=e}this.wasBold=this.isBold,this.wasItalic=this.isItalic}},{key:"mediawiki",get:function(){var t=this;return{name:"mediawiki",startState:function(){return{tokenize:t.eatWikiText(""),stack:[],inHtmlTag:[],extName:!1,extMode:!1,extState:!1,nTemplate:0,nLink:0,nExt:0}},copyState:function(t){return{tokenize:t.tokenize,stack:t.stack.concat([]),inHtmlTag:t.inHtmlTag.concat([]),extName:t.extName,extMode:t.extMode,extState:!1!==t.extMode&&t.extMode.copyState(t.extState),nTemplate:t.nTemplate,nLink:t.nLink,nExt:t.nExt}},token:function(e,a){var i,n,s,r,o=[],l=[];if(t.oldTokens.length>0)return s=t.oldTokens.shift(),e.pos=s.pos,a=s.state,s.style;e.sol()&&(t.isBold=!1,t.isItalic=!1,t.firstSingleLetterWord=null,t.firstMultiLetterWord=null,t.firstSpace=null);do{if(i=a.tokenize(e,a),!(r=t.firstSingleLetterWord||t.firstMultiLetterWord||t.firstSpace))return t.oldStyle=i,i;r!==n&&(n=r,l.length>0&&(o=o.concat(l),l=[])),l.push({pos:e.pos,style:i,state:(a.extMode||t.mediawiki).copyState(a)})}while(!e.eol());if(t.isBold&&t.isItalic){if(t.isItalic=t.wasItalic,t.isBold=t.wasBold,t.firstSingleLetterWord=null,t.firstMultiLetterWord=null,t.firstSpace=null,!(o.length>0))return e.pos=l[0].pos-2,t.oldStyle;o[o.length-1].pos++,t.oldTokens=o}else t.oldTokens=o.concat(l);return s=t.oldTokens.shift(),e.pos=s.pos,a=s.state,s.style},blankLine:function(t){t.extMode&&t.extMode.blankLine&&t.extMode.blankLine(t.extState)},tokenTable:this.tokenTable}}}]),e}();module.exports=function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{bidiIsolation:!1},a=arguments.length>1&&void 0!==arguments[1]?arguments[1]:null;a=a||mw.config.get("extCodeMirrorConfig");var n=new d(a).mediawiki,s=t.StreamLanguage.define(n),r=[t.syntaxHighlighting(t.HighlightStyle.define(i.getTagStyles(n)))],o=a.templateFoldingNamespaces;return o&&!o.includes(mw.config.get("wgNamespaceNumber"))||r.push(g),e.bidiIsolation&&r.push(f),new t.LanguageSupport(s,r)};
