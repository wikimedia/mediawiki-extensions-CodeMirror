/**
 * Forked from https://github.com/fsegurai/codemirror-themes/tree/51238e12fe/packages/material-light
 * License: https://opensource.org/licenses/MIT
 */

const { EditorView, HighlightStyle, syntaxHighlighting, tags } = require( 'ext.CodeMirror.lib' );

// Base colors
const base00 = '#ffffff', // Background - pure white for clean look
	base01 = '#f5f5f5', // Lighter background (popups, statuslines)
	base02 = '#212121', // Main text - nearly black for contrast
	base03 = '#757575', // Comments, invisibles - gray 600
	base04 = '#9e9e9e', // Cursor and line numbers - gray 500
	base05 = '#424242', // Default foreground - gray 800
	// Accent colors - using standard Material Design palette
	base08 = '#f44336', // Red 500
	base09 = '#ff3e00', // Deep Orange 500
	base0A = '#FF00E9FF', // Pink 500
	base0B = '#ffc107', // Amber 500 (better than yellow for light theme)
	base0C = '#ff9800', // Orange 500
	base0D = '#00acc1', // Cyan 600 (better contrast for light theme)
	base0E = '#3949ab', // Indigo 600 (better contrast for light theme)
	base0F = '#8e24aa', // Purple 600 (better contrast for light theme)
	base10 = '#43a047', // Green 600 (better contrast for light theme)
	base11 = '#00897b', // Teal 600 (better contrast for light theme)
	base12 = '#1e88e5'; // Blue 600 (better contrast for light theme)
// UI specific colors
const invalid = base08,
	highlightBackground = '#00000008', // Line highlight
	background = base00,
	tooltipBackground = base01,
	selection = '#DDEEFF', // Selection background
	selectionMatch = '#90a4ae26', // Selection match background
	cursor = base04, // Cursor color
	activeBracketBg = '#DDEEFF80', // Active bracket background
	activeBracketBorder = base0D, // Active bracket border
	diagnosticWarning = base0C, // Warning color
	linkColor = base0D, // Link color
	visitedLinkColor = base0F, // Visited link color
	hoverHighlight = '#ECEFF180'; // Hover highlight

/**
 * Enhanced editor theme styles for Material Light
 */
const materialLightTheme = EditorView.theme( {
	// Base editor styles
	'&': {
		color: base02,
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
		backgroundColor: '#FFA72680',
		outline: `1px solid ${ base0B }`,
		color: base02,
		'& span': {
			color: base02
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
		border: `1px solid ${ base04 }`,
		boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
	},
	'.cm-tooltip-autocomplete': {
		'& > ul': {
			backgroundColor: tooltipBackground,
			border: 'none'
		},
		'& > ul > li[aria-selected]': {
			backgroundColor: hoverHighlight,
			color: base02
		},
		'& > ul > li:hover': {
			backgroundColor: hoverHighlight
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
		backgroundColor: `${ invalid }20`,
		outline: `1px solid ${ invalid }`
	},
	// Selection matches
	'.cm-selectionMatch': {
		backgroundColor: selectionMatch,
		outline: `1px solid ${ base03 }30`
	},
	// Fold placeholder
	'.cm-foldPlaceholder': {
		backgroundColor: base01,
		color: base03,
		border: `1px dotted ${ base03 }70`
	}
}, { dark: false } );
/**
 * Enhanced syntax highlighting for Material Light theme
 */
const materialLightHighlightStyle = HighlightStyle.define( [
	// Keywords and control flow
	{ tag: tags.keyword, color: base0D, fontWeight: 'bold' },
	{ tag: tags.controlKeyword, color: base0D, fontWeight: 'bold' },
	{ tag: tags.moduleKeyword, color: base0D, fontWeight: 'bold' },
	// Names and variables
	{ tag: [ tags.name, tags.deleted, tags.character, tags.macroName ], color: base05 },
	{ tag: [ tags.variableName ], color: base05 },
	{ tag: [ tags.propertyName ], color: base11, fontStyle: 'normal' },
	// Classes and types
	{ tag: [ tags.typeName ], color: base0C },
	{ tag: [ tags.className ], color: base0C, fontStyle: 'italic' },
	{ tag: [ tags.namespace ], color: base0E, fontStyle: 'italic' },
	// Operators and punctuation
	{ tag: [ tags.operator, tags.operatorKeyword ], color: base0E },
	{ tag: [ tags.bracket ], color: base0F },
	{ tag: [ tags.brace ], color: base0F },
	{ tag: [ tags.punctuation ], color: base03 },
	// Functions and parameters
	{ tag: [ tags.function( tags.variableName ) ], color: base09 },
	{ tag: [ tags.labelName ], color: base12, fontStyle: 'italic' },
	{ tag: [ tags.definition( tags.function( tags.variableName ) ) ], color: base09 },
	{ tag: [ tags.definition( tags.variableName ) ], color: base0A },
	// Constants and literals
	{ tag: tags.number, color: base0C },
	{ tag: tags.changed, color: base0C },
	{ tag: tags.annotation, color: invalid, fontStyle: 'italic' },
	{ tag: tags.modifier, color: base0C, fontStyle: 'italic' },
	{ tag: tags.self, color: base0C },
	{
		tag: [ tags.color, tags.constant( tags.name ), tags.standard( tags.name ) ],
		color: base0C
	},
	{ tag: [ tags.atom, tags.bool ], color: base0F },
	// Strings and regex
	{ tag: [ tags.processingInstruction, tags.inserted ], color: base10 },
	{ tag: tags.string, color: base10 },
	{ tag: [ tags.special( tags.string ), tags.regexp ], color: base0A },
	// Punctuation and structure
	{ tag: tags.definition( tags.typeName ), color: base0A, fontWeight: 'bold' },
	{ tag: [ tags.definition( tags.name ), tags.separator ], color: base0A },
	// Comments and documentation
	{ tag: tags.meta, color: base03 },
	{ tag: tags.comment, fontStyle: 'italic', color: base03 },
	{ tag: tags.docComment, fontStyle: 'italic', color: base03 },
	// HTML/XML elements
	{ tag: [ tags.tagName ], color: base09 },
	{ tag: [ tags.attributeName ], color: base05 },
	// Markdown and text formatting
	{ tag: [ tags.heading ], fontWeight: 'bold', color: base11 },
	{ tag: tags.heading1, color: base12 },
	{ tag: tags.heading2, color: base0C },
	{ tag: tags.heading3, color: base0D },
	{ tag: tags.heading4, color: base0E },
	{ tag: tags.heading5, color: base0F },
	{ tag: tags.heading6, color: base10 },
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
		color: base02,
		textDecoration: 'underline wavy'
	},
	{ tag: [ tags.strikethrough ], color: invalid, textDecoration: 'line-through' },
	// Enhanced syntax highlighting
	{ tag: tags.constant( tags.name ), color: base09 },
	{ tag: tags.deleted, color: invalid },
	{ tag: tags.squareBracket, color: base08 },
	{ tag: tags.angleBracket, color: base02 },
	// Additional specific styles
	{ tag: tags.monospace, color: base02 },
	{ tag: [ tags.contentSeparator ], color: base0D },
	{ tag: tags.quote, color: base10 }
] );
/**
 * Combined Material Light theme extension
 */
const materialLight = [
	materialLightTheme,
	syntaxHighlighting( materialLightHighlightStyle )
];

module.exports = materialLight;
