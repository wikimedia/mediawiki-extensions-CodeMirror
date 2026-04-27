/**
 * Forked from https://github.com/fsegurai/codemirror-themes/tree/51238e12fe/packages/tokyo-night-day
 * License: https://opensource.org/licenses/MIT
 */

const { EditorView, HighlightStyle, syntaxHighlighting, tags } = require( 'ext.CodeMirror.lib' );

// Base colors
const base00 = '#e1e2e7', // Background
	base01 = '#3760bf', // Primary foreground
	base02 = '#99a7df', // Selection background
	base03 = '#848cb5', // Comments, invisibles
	base04 = '#8c91a8', // Dark foreground (status)
	base05 = '#3760bf', // Default foreground
	base06 = '#e9e9ec', // Light background
	// Accent colors
	baseRed = '#f52a65', // Errors, invalid
	baseOrange = '#b15c00', // Numbers, constants
	baseYellow = '#8c6c3e', // Classes, attributes
	baseGreen = '#587539', // Strings, success
	baseCyan = '#007197', // Functions, keywords
	baseBlue = '#2e7de9', // Variables, parameters
	basePurple = '#7847bd', // Operators, tags
	baseMagenta = '#9854f1'; // Special characters
// UI specific colors
const invalid = baseRed,
	highlightBackground = '#5F5FAF5A', // Line highlight with improved transparency
	background = base00,
	tooltipBackground = base06,
	selection = '#99a7df40', // Selection background with transparency
	selectionMatch = '#99a7df60', // Selection match with transparency
	cursor = base01, // Cursor color
	activeBracketBg = '#0e639c20', // Active bracket background with transparency
	activeBracketBorder = baseCyan, // Active bracket border
	diagnosticWarning = baseOrange, // Warning color
	linkColor = baseCyan, // Link color
	visitedLinkColor = basePurple; // Visited link color

/**
 * Enhanced editor theme styles for Tokyo Night Day
 */
const tokyoNightDayTheme = EditorView.theme( {
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
		backgroundColor: '#0e639c40',
		outline: `1px solid ${ baseCyan }`,
		color: base05
	},
	'.cm-searchMatch.cm-searchMatch-selected': {
		backgroundColor: baseCyan,
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
		border: `1px solid ${ base04 }40`,
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
		backgroundColor: `${ baseRed }20`,
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
}, { dark: false } );
/**
 * Enhanced syntax highlighting for Tokyo Night Day theme
 */
const tokyoNightDayHighlightStyle = HighlightStyle.define( [
	// Keywords and control flow
	{ tag: tags.keyword, color: baseCyan, fontWeight: 'bold' },
	{ tag: tags.controlKeyword, color: baseCyan, fontWeight: 'bold' },
	{ tag: tags.moduleKeyword, color: baseCyan, fontWeight: 'bold' },
	// Names and variables
	{ tag: [ tags.name, tags.deleted, tags.character, tags.macroName ], color: baseBlue },
	{ tag: [ tags.variableName ], color: base01 },
	{ tag: [ tags.propertyName ], color: baseBlue, fontStyle: 'normal' },
	// Classes and types
	{ tag: [ tags.typeName ], color: baseCyan },
	{ tag: [ tags.className ], color: baseYellow, fontStyle: 'italic' },
	{ tag: [ tags.namespace ], color: basePurple, fontStyle: 'italic' },
	// Operators and punctuation
	{ tag: [ tags.operator, tags.operatorKeyword ], color: basePurple },
	{ tag: [ tags.bracket ], color: base03 },
	{ tag: [ tags.brace ], color: base03 },
	{ tag: [ tags.punctuation ], color: base03 },
	// Functions and parameters
	{ tag: [ tags.function( tags.variableName ) ], color: baseCyan },
	{ tag: [ tags.labelName ], color: basePurple, fontStyle: 'italic' },
	{ tag: [ tags.definition( tags.function( tags.variableName ) ) ], color: baseCyan },
	{ tag: [ tags.definition( tags.variableName ) ], color: baseBlue },
	// Constants and literals
	{ tag: tags.number, color: baseOrange },
	{ tag: tags.changed, color: baseOrange },
	{ tag: tags.annotation, color: invalid, fontStyle: 'italic' },
	{ tag: tags.modifier, color: baseOrange, fontStyle: 'italic' },
	{ tag: tags.self, color: baseOrange },
	{
		tag: [ tags.color, tags.constant( tags.name ), tags.standard( tags.name ) ],
		color: baseOrange
	},
	{ tag: [ tags.atom, tags.bool, tags.special( tags.variableName ) ], color: baseOrange },
	// Strings and regex
	{ tag: [ tags.processingInstruction, tags.inserted ], color: baseGreen },
	{ tag: [ tags.special( tags.string ), tags.regexp ], color: baseMagenta },
	{ tag: tags.string, color: baseGreen },
	// Punctuation and structure
	{ tag: tags.definition( tags.typeName ), color: baseCyan, fontWeight: 'bold' },
	{ tag: [ tags.definition( tags.name ), tags.separator ], color: baseBlue },
	// Comments and documentation
	{ tag: tags.meta, color: base03 },
	{ tag: tags.comment, fontStyle: 'italic', color: base03 },
	{ tag: tags.docComment, fontStyle: 'italic', color: base03 },
	// HTML/XML elements
	{ tag: [ tags.tagName ], color: basePurple },
	{ tag: [ tags.attributeName ], color: baseYellow },
	// Markdown and text formatting
	{ tag: [ tags.heading ], fontWeight: 'bold', color: baseOrange },
	{ tag: tags.heading1, color: baseOrange, fontWeight: 'bold' },
	{ tag: tags.heading2, color: baseOrange },
	{ tag: tags.heading3, color: baseOrange },
	{ tag: tags.heading4, color: baseCyan },
	{ tag: tags.heading5, color: baseCyan },
	{ tag: tags.heading6, color: baseCyan },
	{ tag: [ tags.strong ], fontWeight: 'bold', color: base01 },
	{ tag: [ tags.emphasis ], fontStyle: 'italic', color: baseGreen },
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
	{ tag: tags.constant( tags.name ), color: baseOrange },
	{ tag: tags.deleted, color: invalid },
	{ tag: tags.squareBracket, color: base03 },
	{ tag: tags.angleBracket, color: base03 },
	// Additional specific styles
	{ tag: tags.monospace, color: base01 },
	{ tag: [ tags.contentSeparator ], color: baseBlue },
	{ tag: tags.quote, color: base03 }
] );
/**
 * Combined Tokyo Night Day theme extension
 */
const tokyoNightDay = [
	tokyoNightDayTheme,
	syntaxHighlighting( tokyoNightDayHighlightStyle )
];

module.exports = tokyoNightDay;
