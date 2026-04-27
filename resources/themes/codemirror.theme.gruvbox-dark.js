/**
 * Forked from https://github.com/fsegurai/codemirror-themes/tree/51238e12fe/packages/gruvbox-dark
 * License: https://opensource.org/licenses/MIT
 */

const { EditorView, HighlightStyle, syntaxHighlighting, tags } = require( 'ext.CodeMirror.lib' );

// Gruvbox base colors
const base00 = '#282828', // Background
	base01 = '#3c3836', // Lighter background (popups, statuslines)
	base02 = '#504945', // Selection background
	base03 = '#665c54', // Comments, invisibles, line highlighting
	base05 = '#928374', // Comments, invisibles, line highlighting
	// Light/foreground shades
	base06 = '#fbf1c7', // Light foreground (preferbase08)
	base07 = '#ebdbb2', // Light foreground (alternative)
	// Accent colors
	base08 = '#fb4934', // Keywords, storage, operator
	base09 = '#b8bb26', // Strings, tag attributes
	base0A = '#fabd2f', // Functions, tag names
	base0B = '#83a598', // Variables
	base0C = '#d3869b', // Numbers, special constants
	base0D = '#8ec07c', // Types
	base0E = '#fe8019'; // Cursor, constants
// UI specific colors
const invalid = base08,
	highlightBackground = '#3c383660', // Line highlight with transparency
	background = base00,
	tooltipBackground = base01,
	selection = base02,
	selectionMatch = '#665c5480', // Selection match background
	cursor = base0E, // Cursor color
	activeBracketBg = '#504945cc', // Active bracket background
	activeBracketBorder = base0A, // Active bracket border
	diagnosticWarning = base0A, // Warning color
	linkColor = base0B, // Link color
	visitedLinkColor = base0C; // Visited link color

/**
 * Enhanced editor theme styles for Gruvbox Dark
 */
const gruvboxDarkTheme = EditorView.theme( {
	// Base editor styles
	'&': {
		color: base07,
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
		backgroundColor: '#b57614cc',
		outline: `1px solid ${ base0A }`,
		color: base06,
		'& span': {
			color: base06
		}
	},
	'.cm-searchMatch.cm-searchMatch-selected': {
		backgroundColor: base0E,
		color: base00,
		'& span': {
			color: base00
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
			color: base05
		},
		'& > ul > li > span.cm-completionDetail': {
			color: base05,
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
		backgroundColor: '#cc241d55',
		outline: `1px solid ${ invalid }`
	},
	// Selection matches
	'.cm-selectionMatch': {
		backgroundColor: selectionMatch,
		outline: `1px solid ${ base03 }`
	},
	// Fold placeholder
	'.cm-foldPlaceholder': {
		backgroundColor: tooltipBackground,
		color: base05,
		border: `1px dotted ${ base03 }`
	}
}, { dark: true } );
/**
 * Enhanced syntax highlighting for Gruvbox Dark theme
 */
const gruvboxDarkHighlightStyle = HighlightStyle.define( [
	// Keywords and control flow
	{ tag: tags.keyword, color: base08, fontWeight: 'bold' },
	{ tag: tags.controlKeyword, color: base08, fontWeight: 'bold' },
	{ tag: tags.moduleKeyword, color: base08, fontWeight: 'bold' },
	// Names and variables
	{ tag: [ tags.name, tags.deleted, tags.character, tags.macroName ], color: base0B },
	{ tag: [ tags.variableName ], color: base0B },
	{ tag: [ tags.propertyName ], color: base0D, fontStyle: 'normal' },
	// Classes and types
	{ tag: [ tags.typeName ], color: base0D },
	{ tag: [ tags.className ], color: base0A, fontStyle: 'italic' },
	{ tag: [ tags.namespace ], color: base0B, fontStyle: 'italic' },
	// Operators and punctuation
	{ tag: [ tags.operator, tags.operatorKeyword ], color: base07 },
	{ tag: [ tags.bracket ], color: base05 },
	{ tag: [ tags.brace ], color: base05 },
	{ tag: [ tags.punctuation ], color: base05 },
	// Functions and parameters
	{ tag: [ tags.function( tags.variableName ), tags.labelName ], color: base0A },
	{ tag: [ tags.definition( tags.variableName ) ], color: base0B },
	// Constants and literals
	{ tag: tags.number, color: base0C },
	{ tag: tags.changed, color: base0C },
	{ tag: tags.annotation, color: invalid, fontStyle: 'italic' },
	{ tag: tags.modifier, color: base0C, fontStyle: 'italic' },
	{ tag: tags.self, color: base0C },
	{ tag: [ tags.color, tags.constant( tags.name ), tags.standard( tags.name ) ], color: base0E },
	{ tag: [ tags.atom, tags.bool, tags.special( tags.variableName ) ], color: base0E },
	// Strings and regex
	{ tag: [ tags.processingInstruction, tags.inserted ], color: base09 },
	{ tag: [ tags.special( tags.string ), tags.regexp ], color: base09 },
	{ tag: tags.string, color: base09 },
	// Punctuation and structure
	{ tag: tags.definition( tags.typeName ), color: base0D, fontWeight: 'bold' },
	// Comments and documentation
	{ tag: tags.meta, color: base05 },
	{ tag: tags.comment, fontStyle: 'italic', color: base05 },
	{ tag: tags.docComment, fontStyle: 'italic', color: base05 },
	// HTML/XML elements
	{ tag: [ tags.tagName ], color: base08 },
	{ tag: [ tags.attributeName ], color: base0A },
	// Markdown and text formatting
	{ tag: [ tags.heading ], fontWeight: 'bold', color: base0A },
	{ tag: [ tags.strong ], fontWeight: 'bold', color: base0A },
	{ tag: [ tags.emphasis ], fontStyle: 'italic', color: base09 },
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
		color: invalid,
		borderBottom: `1px dotted ${ invalid }`
	},
	{ tag: [ tags.strikethrough ], color: invalid, textDecoration: 'line-through' },
	// Enhanced syntax highlighting
	{ tag: tags.constant( tags.name ), color: base0E },
	{ tag: tags.deleted, color: invalid },
	{ tag: tags.squareBracket, color: base05 },
	{ tag: tags.angleBracket, color: base05 },
	// Additional specific styles
	{ tag: tags.monospace, color: base07 },
	{ tag: [ tags.contentSeparator ], color: base0B },
	{ tag: tags.quote, color: base05 }
] );
/**
 * Combined Gruvbox Dark theme extension
 */
const gruvboxDark = [
	gruvboxDarkTheme,
	syntaxHighlighting( gruvboxDarkHighlightStyle )
];

module.exports = gruvboxDark;
