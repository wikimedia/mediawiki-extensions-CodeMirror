/**
 * MediaWiki Pygments-compatible dark theme.
 *
 * Palette and text styles are based on the Pygments "monokai" style used by
 * SyntaxHighlight_GeSHi in dark mode. Pygments and Lezer do not have a
 * one-to-one token vocabulary, so this theme maps each standard Lezer tag to
 * the closest Pygments token where an equivalent exists.
 */

const { EditorView, HighlightStyle, syntaxHighlighting, tags } = require( 'ext.CodeMirror.lib' );

const background = '#272822';
const foreground = '#F8F8F2';
const highlight = '#49483e';
const comment = '#959077';
const keyword = '#66D9EF';
const operator = '#FF4689';
const number = '#AE81FF';
const string = '#E6DB74';
const green = '#A6E22E';
const error = '#ED007E';
const errorBorder = '#FF0000';
const deleted = '#FF4689';

const pygmentsDarkTheme = EditorView.theme( {
	// Base editor styles
	'&': {
		color: foreground,
		backgroundColor: background
	},
	// Content and cursor
	'.cm-content': {
		caretColor: foreground
	},
	'.cm-cursor, .cm-dropCursor': {
		borderLeftColor: foreground
	},
	// Selection
	'&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
		backgroundColor: highlight
	},
	// Search functionality
	'.cm-searchMatch': {
		backgroundColor: highlight,
		outline: `1px solid ${ keyword }`
	},
	'.cm-searchMatch.cm-searchMatch-selected': {
		backgroundColor: '#75715e'
	},
	// Line highlighting
	'.cm-activeLine': {
		backgroundColor: '#49483e40'
	},
	// Matching brackets
	'.cm-matchingBracket, &.cm-focused .cm-matchingBracket': {
		backgroundColor: highlight,
		outline: `1px solid ${ keyword }`
	},
	'.cm-nonmatchingBracket, &.cm-focused .cm-nonmatchingBracket': {
		outline: `1px solid ${ error }`
	},
	// Tooltips and autocomplete
	'.cm-tooltip': {
		border: '1px solid #252526',
		boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
	}
}, { dark: true } );

const pygmentsDarkHighlightStyle = HighlightStyle.define( [
	// Comment and Comment.Preproc. The italic comment style is inherited from
	// the light Pygments rule in SyntaxHighlight_GeSHi's combined stylesheet.
	{ tag: [ tags.comment, tags.docComment ], color: comment, fontStyle: 'italic' },
	{ tag: [ tags.meta, tags.documentMeta, tags.processingInstruction ], color: comment, fontStyle: 'normal' },

	// Keyword, Keyword.Namespace, Keyword.Pseudo, Keyword.Type, and Operator.Word.
	// Font weights mirror the effective combined SyntaxHighlight_GeSHi CSS.
	{ tag: tags.keyword, color: keyword, fontWeight: 'bold' },
	{ tag: tags.bool, color: keyword, fontWeight: 'bold' },
	{ tag: tags.moduleKeyword, color: operator, fontWeight: 'bold' },
	{ tag: tags.self, color: foreground },
	{ tag: tags.modifier, color: keyword, fontWeight: 'bold' },
	{ tag: tags.typeName, color: keyword, fontWeight: 'normal' },
	{ tag: tags.operator, color: operator },
	{ tag: tags.operatorKeyword, color: operator, fontWeight: 'bold' },
	{ tag: [ tags.punctuation, tags.bracket ], color: foreground },

	// Name.*.
	{ tag: tags.name, color: foreground },
	{ tag: tags.standard( tags.name ), color: foreground },
	{ tag: tags.function( tags.name ), color: green },
	{ tag: tags.className, color: green, fontWeight: 'bold' },
	{ tag: tags.namespace, color: foreground, fontWeight: 'bold' },
	{ tag: tags.variableName, color: foreground },
	{ tag: tags.constant( tags.name ), color: keyword },
	{ tag: tags.labelName, color: foreground },
	{ tag: tags.propertyName, color: foreground },
	{ tag: tags.attributeName, color: green },
	{ tag: tags.tagName, color: operator, fontWeight: 'bold' },
	{ tag: tags.annotation, color: green },
	{ tag: tags.macroName, color: green },
	{ tag: tags.special( tags.name ), color: green },
	{ tag: tags.special( tags.variableName ), color: foreground },

	// Literal, String.*, and Number.
	{ tag: tags.literal, color: number },
	{ tag: tags.string, color: string },
	{ tag: tags.docString, color: string, fontStyle: 'italic' },
	{ tag: tags.special( tags.string ), color: string, fontWeight: 'bold' },
	{ tag: tags.regexp, color: string },
	{ tag: tags.escape, color: number, fontWeight: 'bold' },
	{ tag: tags.number, color: number },

	// Generic.* equivalents used by markup and diff-like languages. Heading,
	// subheading, emphasis, and strong retain styles inherited from the light
	// Pygments rules in SyntaxHighlight_GeSHi's combined stylesheet.
	{ tag: tags.heading1, color: foreground, fontWeight: 'bold' },
	{
		tag: [ tags.heading2, tags.heading3, tags.heading4, tags.heading5, tags.heading6 ],
		color: comment,
		fontWeight: 'bold'
	},
	{ tag: tags.emphasis, color: foreground, fontStyle: 'italic' },
	{ tag: tags.strong, color: foreground, fontWeight: 'bold' },
	{ tag: tags.quote, color: foreground, fontStyle: 'italic' },
	{ tag: tags.link, color: operator, fontWeight: 'bold' },
	{ tag: tags.url, color: green },
	{ tag: tags.monospace, color: string },
	{ tag: tags.strikethrough, color: deleted },
	{ tag: tags.inserted, color: green },
	{ tag: tags.deleted, color: deleted },

	// Monokai gives Error an opaque background. Token backgrounds are avoided
	// in CodeMirror, so retain the foreground and the border inherited from the
	// light Pygments Error rule instead.
	{ tag: tags.invalid, color: error, border: `1px solid ${ errorBorder }` }
] );

module.exports = [
	pygmentsDarkTheme,
	syntaxHighlighting( pygmentsDarkHighlightStyle )
];
