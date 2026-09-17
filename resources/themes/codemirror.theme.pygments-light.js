/**
 * MediaWiki Pygments-compatible light theme.
 *
 * Palette and text styles are based on the Pygments "default" style used by
 * SyntaxHighlight_GeSHi. Pygments and Lezer do not have a one-to-one token
 * vocabulary, so this theme maps each standard Lezer tag to the closest
 * Pygments token where an equivalent exists.
 */

const { EditorView, HighlightStyle, syntaxHighlighting, tags } = require( 'ext.CodeMirror.lib' );

const background = '#f8f8f8';
const highlight = '#ffffcc';
const selection = '#d7d4f0';
const comment = '#3D7B7B';
const preproc = '#9C6500';
const keyword = '#008000';
const keywordType = '#B00040';
const operator = '#666666';
const wordOperator = '#AA22FF';
const builtin = '#008000';
const functionName = '#0000FF';
const className = '#0000FF';
const namespace = '#0000FF';
const variable = '#19177C';
const constant = '#880000';
const label = '#767600';
const attribute = '#687822';
const tagName = '#008000';
const decorator = '#AA22FF';
const string = '#BA2121';
const interpolated = '#A45A77';
const escape = '#AA5D1F';
const number = '#666666';
const heading = '#000080';
const subheading = '#800080';
const deleted = '#A00000';
const inserted = '#008400';
const errorBorder = '#FF0000';

const pygmentsLightTheme = EditorView.theme( {
	// Base editor styles
	'&': {
		backgroundColor: background
	},
	// Content and cursor
	'.cm-content': {
		caretColor: 'currentColor'
	},
	'.cm-cursor, .cm-dropCursor': {
		borderLeftColor: 'currentColor'
	},
	// Selection
	'&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
		backgroundColor: selection
	},
	// Search functionality
	'.cm-searchMatch': {
		backgroundColor: highlight,
		outline: `1px solid ${ operator }`
	},
	'.cm-searchMatch.cm-searchMatch-selected': {
		backgroundColor: '#ffdf80'
	},
	// Line highlighting
	'.cm-activeLine': {
		backgroundColor: '#eeecc440'
	},
	// Matching brackets
	'.cm-matchingBracket, &.cm-focused .cm-matchingBracket': {
		backgroundColor: '#ecffc2',
		outline: `1px solid ${ operator }`
	},
	'.cm-nonmatchingBracket, &.cm-focused .cm-nonmatchingBracket': {
		outline: `1px solid ${ errorBorder }`
	}
}, { dark: false } );

const pygmentsLightHighlightStyle = HighlightStyle.define( [
	// Comment and Comment.Preproc.
	{ tag: [ tags.comment, tags.docComment ], color: comment, fontStyle: 'italic' },
	{ tag: [ tags.meta, tags.documentMeta, tags.processingInstruction ], color: preproc, fontStyle: 'normal' },

	// Keyword, Keyword.Pseudo, Keyword.Type, and Operator.Word.
	{ tag: tags.keyword, color: keyword, fontWeight: 'bold' },
	{ tag: tags.bool, color: keyword, fontWeight: 'bold' },
	{ tag: tags.self, color: builtin },
	{ tag: tags.modifier, color: keyword, fontWeight: 'bold' },
	{ tag: tags.typeName, color: keywordType, fontWeight: 'normal' },
	{ tag: tags.operator, color: operator },
	{ tag: tags.operatorKeyword, color: wordOperator, fontWeight: 'bold' },

	// Name.*.
	{ tag: tags.standard( tags.name ), color: builtin },
	{ tag: tags.function( tags.name ), color: functionName },
	{ tag: tags.className, color: className, fontWeight: 'bold' },
	{ tag: tags.namespace, color: namespace, fontWeight: 'bold' },
	{ tag: tags.variableName, color: variable },
	{ tag: tags.constant( tags.name ), color: constant },
	{ tag: tags.labelName, color: label },
	{ tag: tags.attributeName, color: attribute },
	{ tag: tags.tagName, color: tagName, fontWeight: 'bold' },
	{ tag: tags.annotation, color: decorator },

	// String.* and Number.
	{ tag: tags.string, color: string },
	{ tag: tags.docString, color: string, fontStyle: 'italic' },
	{ tag: tags.special( tags.string ), color: interpolated, fontWeight: 'bold' },
	{ tag: tags.regexp, color: interpolated },
	{ tag: tags.escape, color: escape, fontWeight: 'bold' },
	{ tag: tags.number, color: number },

	// Generic.* equivalents used by markup and diff-like languages.
	{ tag: tags.heading1, color: heading, fontWeight: 'bold' },
	{
		tag: [ tags.heading2, tags.heading3, tags.heading4, tags.heading5, tags.heading6 ],
		color: subheading,
		fontWeight: 'bold'
	},
	{ tag: tags.emphasis, fontStyle: 'italic' },
	{ tag: tags.strong, fontWeight: 'bold' },
	{ tag: tags.quote, fontStyle: 'italic' },
	{ tag: tags.link, color: tagName, fontWeight: 'bold' },
	{ tag: tags.url, color: attribute },
	{ tag: tags.monospace, color: string },
	{ tag: tags.strikethrough, color: deleted },
	{ tag: tags.inserted, color: inserted },
	{ tag: tags.deleted, color: deleted },

	// Pygments Error uses a border in the default style.
	{ tag: tags.invalid, border: `1px solid ${ errorBorder }` }
] );

module.exports = [
	pygmentsLightTheme,
	syntaxHighlighting( pygmentsLightHighlightStyle )
];
