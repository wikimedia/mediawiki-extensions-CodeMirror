/**
 * Forked from https://github.com/fsegurai/codemirror-themes/tree/51238e12fe/packages/high-contrast-light
 * License: https://opensource.org/licenses/MIT
 */

const { EditorView, HighlightStyle, syntaxHighlighting, tags } = require( 'ext.CodeMirror.lib' );

// Base colors - Pure white and black for maximum contrast
const base00 = '#ffffff', // Background - pure white
	base02 = '#707070', // Comments - medium grey
	base04 = '#000000', // Foreground - pure black
	// High contrast accent colors for a light background
	darkBlue = '#0000ff',
	darkCyan = '#008080',
	darkGreen = '#008000',
	darkRed = '#c80000',
	darkMagenta = '#800080',
	darkOrange = '#d04800',
	darkPurple = '#6600cc',
	darkBrown = '#7c3400';
// UI specific colors
const invalid = darkRed,
	background = base00,
	tooltipBackground = '#f0f0f0',
	selection = '#0078d4',
	selectionMatch = '#0078d480',
	cursor = darkBlue,
	activeBracketBg = '#e0e0e0',
	activeBracketBorder = darkCyan,
	diagnosticWarning = darkOrange,
	linkColor = darkBlue,
	visitedLinkColor = darkPurple;

/**
 * Enhanced editor theme styles for High Contrast Light
 */
const highContrastLightTheme = EditorView.theme( {
	// Base editor styles
	'&': {
		color: base04,
		backgroundColor: background,
		border: `2px solid ${ base04 }`
	},
	// Content and cursor
	'.cm-content': {
		caretColor: cursor
	},
	'.cm-cursor, .cm-dropCursor': {
		borderLeftColor: cursor,
		borderLeftWidth: '3px'
	},
	// Selection
	'&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
		backgroundColor: '#4d90fe',
		outline: `2px solid ${ darkBlue }`
	},
	// Search functionality
	'.cm-searchMatch': {
		backgroundColor: '#ffff00',
		outline: `2px solid ${ darkOrange }`,
		color: base04,
		'& span': {
			color: base04
		}
	},
	'.cm-searchMatch.cm-searchMatch-selected': {
		backgroundColor: darkOrange,
		color: base00,
		outline: `2px solid ${ base04 }`,
		'& span': {
			color: base00
		}
	},
	// Line highlighting
	'.cm-activeLine': {
		backgroundColor: '#ffffccba',
		borderLeft: `3px solid ${ darkBlue }`,
		borderRight: `1px solid ${ base02 }`,
		zIndex: 1
	},
	// Tooltips and autocomplete
	'.cm-tooltip': {
		backgroundColor: tooltipBackground,
		border: `2px solid ${ darkBlue }`,
		color: base04
	},
	'.cm-tooltip-autocomplete': {
		'& > ul': {
			backgroundColor: tooltipBackground,
			border: `2px solid ${ base04 }`
		},
		'& > ul > li[aria-selected]': {
			backgroundColor: selection,
			color: base00,
			border: `2px solid ${ darkBlue }`
		},
		'& > ul > li > span.cm-completionIcon': {
			color: darkCyan
		},
		'& > ul > li > span.cm-completionDetail': {
			color: darkOrange,
			fontStyle: 'italic'
		}
	},
	'.cm-tooltip .cm-tooltip-arrow:before': {
		borderTopColor: 'transparent',
		borderBottomColor: 'transparent'
	},
	'.cm-tooltip .cm-tooltip-arrow:after': {
		borderTopColor: darkBlue,
		borderBottomColor: darkBlue
	},
	// Diagnostics styling
	'.cm-diagnostic': {
		'&-error': {
			borderLeft: `4px solid ${ darkRed }`,
			backgroundColor: '#ff000020'
		},
		'&-warning': {
			borderLeft: `4px solid ${ diagnosticWarning }`,
			backgroundColor: '#ff990020'
		},
		'&-info': {
			borderLeft: `4px solid ${ linkColor }`,
			backgroundColor: '#0000ff20'
		}
	},
	// Matching brackets
	'.cm-matchingBracket, &.cm-focused .cm-matchingBracket': {
		backgroundColor: activeBracketBg,
		outline: `2px solid ${ activeBracketBorder }`
	},
	'.cm-nonmatchingBracket, &.cm-focused .cm-nonmatchingBracket': {
		backgroundColor: '#ff000030',
		outline: `2px solid ${ invalid }`
	},
	// Selection matches
	'.cm-selectionMatch': {
		backgroundColor: selectionMatch,
		outline: `2px solid ${ darkBlue }50`
	},
	// Fold placeholder
	'.cm-foldPlaceholder': {
		backgroundColor: tooltipBackground,
		color: darkBlue,
		border: `2px solid ${ darkBlue }`
	}
}, { dark: false } );
/**
 * Enhanced syntax highlighting for High Contrast Light theme
 */
const highContrastLightHighlightStyle = HighlightStyle.define( [
	// Keywords and control flow
	{ tag: tags.keyword, color: darkMagenta, fontWeight: 'bold' },
	{ tag: tags.controlKeyword, color: darkMagenta, fontWeight: 'bold' },
	{ tag: tags.moduleKeyword, color: darkMagenta, fontWeight: 'bold' },
	// Names and variables
	{ tag: [ tags.name, tags.deleted, tags.character, tags.macroName ], color: base04 },
	{ tag: [ tags.variableName ], color: base04 },
	{ tag: [ tags.propertyName ], color: darkBlue, fontStyle: 'normal' },
	// Classes and types
	{ tag: [ tags.typeName ], color: darkCyan },
	{ tag: [ tags.className ], color: darkCyan, fontStyle: 'italic' },
	{ tag: [ tags.namespace ], color: darkOrange, fontStyle: 'italic' },
	// Operators and punctuation
	{ tag: [ tags.operator, tags.operatorKeyword ], color: darkCyan },
	{ tag: [ tags.bracket ], color: darkBrown },
	{ tag: [ tags.brace ], color: darkCyan },
	{ tag: [ tags.punctuation ], color: base04 },
	// Functions and parameters
	{ tag: [ tags.function( tags.variableName ), tags.labelName ], color: darkBlue },
	{ tag: [ tags.definition( tags.function( tags.variableName ) ) ], color: darkBlue },
	{ tag: [ tags.definition( tags.variableName ) ], color: darkOrange },
	// Constants and literals
	{ tag: tags.number, color: darkOrange },
	{ tag: tags.changed, color: darkOrange },
	{ tag: tags.annotation, color: darkRed, fontStyle: 'italic' },
	{ tag: tags.modifier, color: darkPurple, fontStyle: 'italic' },
	{ tag: tags.self, color: darkRed },
	{
		tag: [ tags.color, tags.constant( tags.name ), tags.standard( tags.name ) ],
		color: darkOrange
	},
	{ tag: [ tags.atom, tags.bool, tags.special( tags.variableName ) ], color: darkOrange },
	// Strings and regex
	{ tag: [ tags.processingInstruction, tags.inserted ], color: darkGreen },
	{ tag: [ tags.special( tags.string ), tags.regexp ], color: darkMagenta },
	{ tag: tags.string, color: darkGreen },
	// Punctuation and structure
	{ tag: tags.definition( tags.typeName ), color: darkCyan, fontWeight: 'bold' },
	{ tag: [ tags.definition( tags.name ), tags.separator ], color: darkBlue },
	// Comments and documentation
	{ tag: tags.meta, color: base02 },
	{ tag: tags.comment, fontStyle: 'italic', color: base02 },
	{ tag: tags.docComment, fontStyle: 'italic', color: base02 },
	// HTML/XML elements
	{ tag: [ tags.tagName ], color: darkMagenta },
	{ tag: [ tags.attributeName ], color: darkCyan },
	// Markdown and text formatting
	{ tag: [ tags.heading ], fontWeight: 'bold', color: darkMagenta },
	{ tag: [ tags.strong ], fontWeight: 'bold', color: darkOrange },
	{ tag: [ tags.emphasis ], fontStyle: 'italic', color: darkMagenta },
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
		color: darkRed,
		borderBottom: `2px dotted ${ darkRed }`
	},
	{ tag: [ tags.strikethrough ], color: darkRed, textDecoration: 'line-through' },
	// Enhanced syntax highlighting
	{ tag: tags.constant( tags.name ), color: darkOrange },
	{ tag: tags.deleted, color: darkRed },
	{ tag: tags.squareBracket, color: darkBrown },
	{ tag: tags.angleBracket, color: darkCyan },
	// Additional specific styles
	{ tag: tags.monospace, color: darkBlue, fontStyle: 'italic' },
	{ tag: [ tags.contentSeparator ], color: darkPurple },
	{ tag: tags.quote, color: darkPurple }
] );
/**
 * Combined High Contrast Light theme extension
 */
const highContrastLight = [
	highContrastLightTheme,
	syntaxHighlighting( highContrastLightHighlightStyle )
];

module.exports = highContrastLight;
