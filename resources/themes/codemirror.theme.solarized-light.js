/**
 * Forked from https://github.com/fsegurai/codemirror-themes/tree/51238e12fe/packages/solarized-light
 * License: https://opensource.org/licenses/MIT
 */

const { EditorView, HighlightStyle, syntaxHighlighting, tags } = require( 'ext.CodeMirror.lib' );

// Base colors from Solarized palette
const base00 = '#657b83', // Body text/default text color
	base01 = '#586e75', // Optional emphasized content
	base02 = '#073642', // Background highlights
	base03 = '#002b36', // Comments, invisible, line highlighting
	base05 = '#93a1a1', // Default foreground/UI text color
	base06 = '#cceeff7a', // Light background tint (for selection)
	base07 = '#fdf6e3', // Background - light base
	base08 = '#eee8d5', // Background tint - light secondary
	// Accent colors from Solarized palette
	base09 = '#dc322f', // Red
	base0A = '#cb4b16', // Orange
	base0B = '#b58900', // Yellow
	base0C = '#859900', // Green
	base0D = '#2aa198', // Cyan
	base0E = '#268bd2', // Blue
	base0F = '#6c71c4', // Violet
	base10 = '#d33682'; // Magenta
// UI specific colors
const invalid = '#d30102', // Bright red for errors
	highlightBackground = base06, // Active line highlight
	background = base07, // Main editor background
	tooltipBackground = '#f0e9d7', // Tooltip background
	selection = '#ffd07a', // Selection background
	selectionMatch = '#e1dbca90', // Selection match with opacity
	cursor = base01, // Cursor color
	activeBracketBg = '#93a1a140', // Active bracket background with opacity
	activeBracketBorder = base0E, // Active bracket border - blue
	diagnosticWarning = base0B, // Warning color - yellow
	linkColor = base0E; // Link color - blue

/**
 * Enhanced editor theme styles for Solarized Light
 */
const solarizedLightTheme = EditorView.theme( {
	// Base editor styles
	'&': {
		color: base00,
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
		backgroundColor: '#93a1a180',
		outline: `1px solid ${ base0E }`,
		color: base01,
		'& span': {
			color: base01
		}
	},
	'.cm-searchMatch.cm-searchMatch-selected': {
		backgroundColor: base0E,
		color: base08,
		'& span': {
			color: base08
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
		border: `1px solid ${ base01 }`,
		boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
	},
	'.cm-tooltip-autocomplete': {
		'& > ul': {
			backgroundColor: tooltipBackground,
			border: 'none'
		},
		'& > ul > li[aria-selected]': {
			backgroundColor: selection,
			color: base01
		},
		'& > ul > li > span.cm-completionIcon': {
			color: base01
		},
		'& > ul > li > span.cm-completionDetail': {
			color: base01,
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
			borderLeft: `3px solid ${ base09 }`
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
		backgroundColor: `${ base09 }40`,
		outline: `1px solid ${ invalid }`
	},
	// Selection matches
	'.cm-selectionMatch': {
		backgroundColor: selectionMatch,
		outline: `1px solid ${ base05 }50`
	},
	// Fold placeholder
	'.cm-foldPlaceholder': {
		backgroundColor: tooltipBackground,
		color: base03,
		border: `1px dotted ${ base05 }70`
	}
}, { dark: false } );
/**
 * Enhanced syntax highlighting for the Solarized Light theme
 */
const solarizedLightHighlightStyle = HighlightStyle.define( [
	// Keywords and control flow
	{ tag: tags.keyword, color: base0C, fontWeight: 'bold' },
	{ tag: tags.controlKeyword, color: base0C, fontWeight: 'bold' },
	{ tag: tags.moduleKeyword, color: base0C, fontWeight: 'bold' },
	// Names and variables
	{ tag: [ tags.name, tags.deleted, tags.character, tags.macroName ], color: base0D },
	{ tag: [ tags.variableName ], color: base00 },
	{ tag: [ tags.propertyName ], color: base0D, fontStyle: 'normal' },
	// Classes and types
	{ tag: [ tags.typeName ], color: base0A },
	{ tag: [ tags.className ], color: base0A, fontStyle: 'italic' },
	{ tag: [ tags.namespace ], color: base10, fontStyle: 'italic' },
	// Operators and punctuation
	{ tag: [ tags.operator, tags.operatorKeyword ], color: base0F },
	{ tag: [ tags.bracket ], color: base10 },
	{ tag: [ tags.brace ], color: base10 },
	{ tag: [ tags.punctuation ], color: base01 },
	// Functions and parameters
	{ tag: [ tags.function( tags.variableName ) ], color: base0E },
	{ tag: [ tags.labelName ], color: base10 },
	{ tag: [ tags.definition( tags.function( tags.variableName ) ) ], color: base0E },
	{ tag: [ tags.definition( tags.variableName ) ], color: base0D },
	// Constants and literals
	{ tag: tags.number, color: base10 },
	{ tag: tags.changed, color: base10 },
	{ tag: tags.annotation, color: invalid, fontStyle: 'italic' },
	{ tag: tags.modifier, color: base10, fontStyle: 'italic' },
	{ tag: tags.self, color: base10 },
	{
		tag: [ tags.color, tags.constant( tags.name ), tags.standard( tags.name ) ],
		color: base0B
	},
	{ tag: [ tags.atom, tags.bool, tags.special( tags.variableName ) ], color: base10 },
	// Strings and regex
	{ tag: [ tags.processingInstruction, tags.inserted ], color: base0C },
	{ tag: [ tags.special( tags.string ), tags.regexp ], color: invalid },
	{ tag: tags.string, color: base0B },
	// Punctuation and structure
	{ tag: tags.definition( tags.typeName ), color: base0A, fontWeight: 'bold' },
	{ tag: [ tags.definition( tags.name ), tags.separator ], color: base0D },
	// Comments and documentation
	{ tag: tags.meta, color: base09 },
	{ tag: tags.comment, fontStyle: 'italic', color: base01 },
	{ tag: tags.docComment, fontStyle: 'italic', color: base01 },
	// HTML/XML elements
	{ tag: [ tags.tagName ], color: base0E },
	{ tag: [ tags.attributeName ], color: base00 },
	// Markdown and text formatting
	{ tag: [ tags.heading ], fontWeight: 'bold', color: base0B },
	{ tag: tags.heading1, color: base03 },
	{ tag: tags.heading2, color: base02 },
	{ tag: tags.heading3, color: base02 },
	{ tag: tags.heading4, color: base02 },
	{ tag: tags.heading5, color: base02 },
	{ tag: tags.heading6, color: base02 },
	{ tag: [ tags.strong ], fontWeight: 'bold', color: base02 },
	{ tag: [ tags.emphasis ], fontStyle: 'italic', color: base0C },
	// Links and URLs
	{
		tag: [ tags.link ],
		color: base0D,
		fontWeight: '500',
		textDecoration: 'underline',
		textUnderlinePosition: 'under'
	},
	{
		tag: [ tags.url ],
		color: base0B,
		textDecoration: 'underline',
		textUnderlineOffset: '2px'
	},
	// Special states
	{
		tag: [ tags.invalid ],
		color: base09,
		borderBottom: `1px dotted ${ base09 }`
	},
	{ tag: [ tags.strikethrough ], color: invalid, textDecoration: 'line-through' },
	// Enhanced syntax highlighting
	{ tag: tags.constant( tags.name ), color: base0B },
	{ tag: tags.deleted, color: base09 },
	{ tag: tags.squareBracket, color: base09 },
	{ tag: tags.angleBracket, color: base01 },
	// Additional specific styles
	{ tag: tags.monospace, color: base00 },
	{ tag: [ tags.contentSeparator ], color: base0B },
	{ tag: tags.quote, color: base0C }
] );
/**
 * Combined Solarized Light theme extension
 */
const solarizedLight = [
	solarizedLightTheme,
	syntaxHighlighting( solarizedLightHighlightStyle )
];

module.exports = solarizedLight;
