/**
 * Forked from https://github.com/fsegurai/codemirror-themes/tree/51238e12fe/packages/solarized-dark
 * License: https://opensource.org/licenses/MIT
 */

const { EditorView, HighlightStyle, syntaxHighlighting, tags } = require( 'ext.CodeMirror.lib' );

// Base colors from Solarized palette
const base00 = '#002b36', // Background - dark blue
	base01 = '#073642', // Lighter background (popups, statuslines)
	base02 = '#586e75', // Selection background
	base03 = '#657b83', // Comments, invisibles
	base04 = '#839496', // Body text
	base05 = '#93a1a1', // Default foreground
	base06 = '#eee8d5', // Light foreground
	base07 = '#fdf6e3', // Light background
	// Accent colors from Solarized palette
	base08 = '#dc322f', // Red
	base09 = '#cb4b16', // Orange
	base0A = '#b58900', // Yellow
	base0B = '#859900', // Green
	base0C = '#2aa198', // Cyan
	base0D = '#268bd2', // Blue
	base0E = '#6c71c4', // Violet
	base0F = '#d33682'; // Magenta
// UI specific colors
const invalid = '#d30102', // Bright red for errors
	highlightBackground = '#99eeff0f', // Active line highlight
	background = base00, // Main editor background
	tooltipBackground = base01, // Tooltip background
	selection = '#02B8FF3F', // Selection background with opacity
	selectionMatch = '#586e7580', // Selection match with opacity
	cursor = base04, // Cursor color
	activeBracketBg = '#586e7540', // Active bracket background with opacity
	activeBracketBorder = base0D, // Active bracket border - blue
	diagnosticWarning = base0A, // Warning color - yellow
	linkColor = base0D; // Link color - blue

/**
 * Enhanced editor theme styles for Solarized Dark
 */
const solarizedDarkTheme = EditorView.theme( {
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
		backgroundColor: '#586e7599',
		outline: `1px solid ${ base0D }`,
		color: base06,
		'& span': {
			color: base06
		}
	},
	'.cm-searchMatch.cm-searchMatch-selected': {
		backgroundColor: base0D,
		color: base07,
		'& span': {
			color: base07
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
		border: `1px solid ${ base02 }`,
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
			borderLeft: `3px solid ${ base08 }`
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
		backgroundColor: `${ base08 }40`,
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
		border: `1px dotted ${ base02 }70`
	}
}, { dark: true } );
/**
 * Enhanced syntax highlighting for Solarized Dark theme
 */
const solarizedDarkHighlightStyle = HighlightStyle.define( [
	// Keywords and control flow
	{ tag: tags.keyword, color: base0B, fontWeight: 'bold' },
	{ tag: tags.controlKeyword, color: base0B, fontWeight: 'bold' },
	{ tag: tags.moduleKeyword, color: base0B, fontWeight: 'bold' },
	// Names and variables
	{ tag: [ tags.name, tags.deleted, tags.character, tags.macroName ], color: base0C },
	{ tag: [ tags.variableName ], color: base05 },
	{ tag: [ tags.propertyName ], color: base0C, fontStyle: 'normal' },
	// Classes and types
	{ tag: [ tags.typeName ], color: base09 },
	{ tag: [ tags.className ], color: base09, fontStyle: 'italic' },
	{ tag: [ tags.namespace ], color: base0F, fontStyle: 'italic' },
	// Operators and punctuation
	{ tag: [ tags.operator, tags.operatorKeyword ], color: base0E },
	{ tag: [ tags.bracket ], color: base0F },
	{ tag: [ tags.brace ], color: base0F },
	{ tag: [ tags.punctuation ], color: base04 },
	// Functions and parameters
	{ tag: [ tags.function( tags.variableName ) ], color: base0D },
	{ tag: [ tags.labelName ], color: base0F },
	{ tag: [ tags.definition( tags.function( tags.variableName ) ) ], color: base0D },
	{ tag: [ tags.definition( tags.variableName ) ], color: base0C },
	// Constants and literals
	{ tag: tags.number, color: base0F },
	{ tag: tags.changed, color: base0F },
	{ tag: tags.annotation, color: invalid, fontStyle: 'italic' },
	{ tag: tags.modifier, color: base0F, fontStyle: 'italic' },
	{ tag: tags.self, color: base0F },
	{
		tag: [ tags.color, tags.constant( tags.name ), tags.standard( tags.name ) ],
		color: base0A
	},
	{ tag: [ tags.atom, tags.bool, tags.special( tags.variableName ) ], color: base0F },
	// Strings and regex
	{ tag: [ tags.processingInstruction, tags.inserted ], color: base0B },
	{ tag: [ tags.special( tags.string ), tags.regexp ], color: invalid },
	{ tag: tags.string, color: base0A },
	// Punctuation and structure
	{ tag: tags.definition( tags.typeName ), color: base09, fontWeight: 'bold' },
	{ tag: [ tags.definition( tags.name ), tags.separator ], color: base0C },
	// Comments and documentation
	{ tag: tags.meta, color: base08 },
	{ tag: tags.comment, fontStyle: 'italic', color: base02 },
	{ tag: tags.docComment, fontStyle: 'italic', color: base02 },
	// HTML/XML elements
	{ tag: [ tags.tagName ], color: base0D },
	{ tag: [ tags.attributeName ], color: base05 },
	// Markdown and text formatting
	{ tag: [ tags.heading ], fontWeight: 'bold', color: base0A },
	{ tag: tags.heading1, color: base07 },
	{ tag: tags.heading2, color: base06 },
	{ tag: tags.heading3, color: base06 },
	{ tag: tags.heading4, color: base06 },
	{ tag: tags.heading5, color: base06 },
	{ tag: tags.heading6, color: base06 },
	{ tag: [ tags.strong ], fontWeight: 'bold', color: base06 },
	{ tag: [ tags.emphasis ], fontStyle: 'italic', color: base0B },
	// Links and URLs
	{
		tag: [ tags.link ],
		color: base0C,
		fontWeight: '500',
		textDecoration: 'underline',
		textUnderlinePosition: 'under'
	},
	{
		tag: [ tags.url ],
		color: base0A,
		textDecoration: 'underline',
		textUnderlineOffset: '2px'
	},
	// Special states
	{
		tag: [ tags.invalid ],
		color: base08,
		borderBottom: `1px dotted ${ base08 }`
	},
	{ tag: [ tags.strikethrough ], color: invalid, textDecoration: 'line-through' },
	// Enhanced syntax highlighting
	{ tag: tags.constant( tags.name ), color: base0A },
	{ tag: tags.deleted, color: base08 },
	{ tag: tags.squareBracket, color: base08 },
	{ tag: tags.angleBracket, color: base02 },
	// Additional specific styles
	{ tag: tags.monospace, color: base05 },
	{ tag: [ tags.contentSeparator ], color: base0A },
	{ tag: tags.quote, color: base0B }
] );
/**
 * Combined Solarized Dark theme extension
 */
const solarizedDark = [
	solarizedDarkTheme,
	syntaxHighlighting( solarizedDarkHighlightStyle )
];

module.exports = solarizedDark;
