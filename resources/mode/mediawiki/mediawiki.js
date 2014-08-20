// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: http://codemirror.net/LICENSE

(function(mod) {
  if (typeof exports == "object" && typeof module == "object") // CommonJS
    mod(require("../../lib/codemirror"), require("../htmlmixed/htmlmixed"));
  else if (typeof define == "function" && define.amd) // AMD
    define(["../../lib/codemirror", "../htmlmixed/htmlmixed"], mod);
  else // Plain browser env
    mod(CodeMirror);
})(function(CodeMirror) {
"use strict";

CodeMirror.defineMode("mediawiki", function(config, parserConfig) {
	function inTemplatePageName(stream, state) { // {{
		if (stream.eat("#")) {
			state.tokenize = inParserFunctionName;
			return "strong";
		}
		stream.eatWhile(/[^\|}]/);
		state.tokenize = inTemplateArgumentSeparator;
		return "link";
	}

	function inTemplateArgumentSeparator(stream, state) { // {{ Page name |
		if (stream.eat("|")) {
			state.tokenize = inTemplateArgument;
			return "tag strong";
		}
		if (stream.eat("}")) {
			if (stream.eat("}")) {
				state.tokenize = inText;
				return "tag bracket";
			}
		}
		stream.next();
		return null;
	}

	function inTemplateArgument(stream, state) { // {{ Page name |
		stream.eatWhile(/[^\|}]/);
		state.tokenize = inTemplateArgumentSeparator;
		return "string";
	}

	function inParserFunctionName(stream, state) { // {{#
		stream.eatWhile(/[^:}]/);
		state.tokenize = inParserFunctionArgumentSeparator;
		return "keyword";
	}

	function inParserFunctionArgumentSeparator(stream, state) { // {{ Page name |
		if (stream.eat(/[|:]/)) {
			state.tokenize = inParserFunctionArgument;
			return "tag strong";
		}
		if (stream.eat("}")) {
			if (stream.eat("}")) {
				state.tokenize = inText;
				return "tag bracket";
			}
		}
		stream.next();
		return "string";
	}

	function inParserFunctionArgument(stream, state) { // {{#
		stream.eatWhile(/[^|}]/);
		state.tokenize = inParserFunctionArgumentSeparator;
		return "string";
	}

	function inText(stream, state) {
		var ch = stream.next();

		switch (ch) {
			case "{":
				if (stream.eat("{")) { // Templates
					state.tokenize = inTemplatePageName;
					stream.eatSpace();
					return "tag bracket";
				}
				break;
		}
		return null;
	}

	return {
		startState: function() {
			return {tokenize: inText, style: null};
		},
		token: function(stream, state) {
			return state.tokenize(stream, state);
		}
	};
});

CodeMirror.defineMIME("text/mediawiki", "mediawiki");

});
