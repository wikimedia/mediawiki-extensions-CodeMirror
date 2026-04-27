/**
 * Forked from https://github.com/fsegurai/codemirror-themes/tree/51238e12fe/packages/material-dark
 * License: https://opensource.org/licenses/MIT
 */

const { EditorView, HighlightStyle, syntaxHighlighting, tags } = require( 'ext.CodeMirror.lib' );

// Base colors
const base00 = '#212121', // Background
	base01 = '#505d64', // Lighter background (popups, statuslines)
	base02 = '#606f7a', // Selection background
	base03 = '#707d8b', // Comments, invisibles, line highlighting
	base04 = '#a0a4ae', // Dark foreground (cursor)
	base05 = '#bdbdbd', // Default foreground
	base06 = '#e0e0e0', // Light foreground
	// Accent colors
	base08 = '#ff5f52', // Keywords, storage, errors
	base09 = '#ff6e40', // Constants, attributes
	base0A = '#fa5788', // Regex, special symbols
	base0B = '#facf4e', // Classes, numbers
	base0C = '#ffad42', // Strings, values
	base0D = '#56c8d8', // Support, functions
	base0E = '#7186f0', // Variables, parameters
	base0F = '#cf6edf', // Operators, tags
	base10 = '#6abf69', // Added elements
	base11 = '#99d066', // Modified elements
	base12 = '#4ebaaa'; // Markup headings
// UI specific colors
const invalid = base08,
	highlightBackground = '#2d333b30', // Line highlight with transparency
	background = base00,
	tooltipBackground = base01,
	selection = '#ffffff1f', // Selection background with transparency
	selectionMatch = '#4A707A80', // Selection match background with transparency
	cursor = base04, // Cursor color
	activeBracketBg = '#39496650', // Active bracket background with transparency
	activeBracketBorder = base0D, // Active bracket border
	diagnosticWarning = base0C, // Warning color
	linkColor = base0D, // Link color
	visitedLinkColor = base0F; // Visited link color

/**
 * Enhanced editor theme styles for Material Dark
 */
const materialDarkTheme = EditorView.theme( {
	// Base editor styles
	'&': {
		color: base05,
		backgroundColor: background
	},
	// Content and cursor
	'.cm-content': {
		caretColor: cursor
	},
	'.cm-cursor, .cm-dropCursor': {
		borderLeftColor: cursor
	},
	// Selection
	'&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
		backgroundColor: selection
	},
	// Search functionality
	'.cm-searchMatch': {
		backgroundColor: '#394966cc',
		outline: `1px solid ${ base0D }`,
		color: base06,
		'& span': {
			color: base06
		}
	},
	'.cm-searchMatch.cm-searchMatch-selected': {
		backgroundColor: base0D,
		color: background,
		'& span': {
			color: background
		}
	},
	// Line highlighting
	'.cm-activeLine': {
		backgroundColor: highlightBackground,
		zIndex: 1
	},
	// Tooltips and autocomplete
	'.cm-tooltip': {
		backgroundColor: tooltipBackground,
		border: `1px solid ${ base03 }`,
		boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
	},
	'.cm-tooltip-autocomplete': {
		'& > ul': {
			backgroundColor: tooltipBackground,
			border: 'none'
		},
		'& > ul > li[aria-selected]': {
			backgroundColor: selection,
			color: base06
		},
		'& > ul > li > span.cm-completionIcon': {
			color: base03
		},
		'& > ul > li > span.cm-completionDetail': {
			color: base03,
			fontStyle: 'italic'
		}
	},
	'.cm-tooltip .cm-tooltip-arrow:before': {
		borderTopColor: 'transparent',
		borderBottomColor: 'transparent'
	},
	'.cm-tooltip .cm-tooltip-arrow:after': {
		borderTopColor: tooltipBackground,
		borderBottomColor: tooltipBackground
	},
	// Diagnostics styling
	'.cm-diagnostic': {
		'&-error': {
			borderLeft: `3px solid ${ invalid }`
		},
		'&-warning': {
			borderLeft: `3px solid ${ diagnosticWarning }`
		},
		'&-info': {
			borderLeft: `3px solid ${ linkColor }`
		}
	},
	// Matching brackets
	'.cm-matchingBracket, &.cm-focused .cm-matchingBracket': {
		backgroundColor: activeBracketBg,
		outline: `1px solid ${ activeBracketBorder }`
	},
	'.cm-nonmatchingBracket, &.cm-focused .cm-nonmatchingBracket': {
		backgroundColor: '#ff5f5240',
		outline: `1px solid ${ invalid }`
	},
	// Selection matches
	'.cm-selectionMatch': {
		backgroundColor: selectionMatch,
		outline: `1px solid ${ base02 }50`
	},
	// Fold placeholder
	'.cm-foldPlaceholder': {
		backgroundColor: tooltipBackground,
		color: base03,
		border: `1px dotted ${ base03 }70`
	}
}, { dark: true } );
/**
 * Enhanced syntax highlighting for Material Dark theme
 */
const materialDarkHighlightStyle = HighlightStyle.define( [
	// Keywords and control flow
	{ tag: tags.keyword, color: base08, fontWeight: 'bold' },
	{ tag: tags.controlKeyword, color: base08, fontWeight: 'bold' },
	{ tag: tags.moduleKeyword, color: base08, fontWeight: 'bold' },
	// Names and variables
	{ tag: [ tags.name, tags.deleted, tags.character, tags.macroName ], color: base0E },
	{ tag: [ tags.variableName ], color: base11 },
	{ tag: [ tags.propertyName ], color: base0F, fontStyle: 'normal' },
	// Classes and types
	{ tag: [ tags.typeName ], color: base08 },
	{ tag: [ tags.className ], color: base0B, fontStyle: 'italic' },
	{ tag: [ tags.namespace ], color: base0E, fontStyle: 'italic' },
	// Operators and punctuation
	{ tag: [ tags.operator, tags.operatorKeyword ], color: base05 },
	{ tag: [ tags.bracket ], color: base03 },
	{ tag: [ tags.brace ], color: base03 },
	{ tag: [ tags.punctuation ], color: base03 },
	// Functions and parameters
	{ tag: [ tags.function( tags.variableName ) ], color: base0D },
	{ tag: [ tags.labelName ], color: base0D, fontStyle: 'italic' },
	{ tag: [ tags.definition( tags.function( tags.variableName ) ) ], color: base0D },
	{ tag: [ tags.definition( tags.variableName ) ], color: base0E },
	// Constants and literals
	{ tag: tags.number, color: base0B },
	{ tag: tags.changed, color: base0B },
	{ tag: tags.annotation, color: invalid, fontStyle: 'italic' },
	{ tag: tags.modifier, color: base09, fontStyle: 'italic' },
	{ tag: tags.self, color: base09 },
	{
		tag: [ tags.color, tags.constant( tags.name ), tags.standard( tags.name ) ],
		color: base09
	},
	{ tag: [ tags.atom, tags.bool, tags.special( tags.variableName ) ], color: base09 },
	// Strings and regex
	{ tag: [ tags.processingInstruction, tags.inserted ], color: base10 },
	{ tag: [ tags.special( tags.string ), tags.regexp ], color: base0A },
	{ tag: tags.string, color: base0C },
	// Punctuation and structure
	{ tag: tags.definition( tags.typeName ), color: base08, fontWeight: 'bold' },
	// Comments and documentation
	{ tag: tags.meta, color: base03 },
	{ tag: tags.comment, fontStyle: 'italic', color: base03 },
	{ tag: tags.docComment, fontStyle: 'italic', color: base03 },
	// HTML/XML elements
	{ tag: [ tags.tagName ], color: base0F },
	{ tag: [ tags.attributeName ], color: base0B },
	// Markdown and text formatting
	{ tag: [ tags.heading ], fontWeight: 'bold', color: base12 },
	{ tag: tags.heading1, color: base0B },
	{ tag: tags.heading2, color: base0C },
	{ tag: tags.heading3, color: base0D },
	{ tag: tags.heading4, color: base0E },
	{ tag: tags.heading5, color: base0F },
	{ tag: tags.heading6, color: base08 },
	{ tag: [ tags.strong ], fontWeight: 'bold', color: base0E },
	{ tag: [ tags.emphasis ], fontStyle: 'italic', color: base0C },
	// Links and URLs
	{
		tag: [ tags.link ],
		color: visitedLinkColor,
		fontWeight: '500',
		textDecoration: 'underline',
		textUnderlinePosition: 'under'
	},
	{
		tag: [ tags.url ],
		color: linkColor,
		textDecoration: 'underline',
		textUnderlineOffset: '2px'
	},
	// Special states
	{
		tag: [ tags.invalid ],
		color: base05,
		textDecoration: 'underline wavy'
	},
	{ tag: [ tags.strikethrough ], color: invalid, textDecoration: 'line-through' },
	// Enhanced syntax highlighting
	{ tag: tags.constant( tags.name ), color: base09 },
	{ tag: tags.deleted, color: invalid },
	{ tag: tags.squareBracket, color: base03 },
	{ tag: tags.angleBracket, color: base03 },
	// Additional specific styles
	{ tag: tags.monospace, color: base05 },
	{ tag: [ tags.contentSeparator ], color: base0E },
	{ tag: tags.quote, color: base03 }
] );
/**
 * Combined Material Dark theme extension
 */
const materialDark = [
	materialDarkTheme,
	syntaxHighlighting( materialDarkHighlightStyle )
];

module.exports = materialDark;
