/**
 * Forked from https://github.com/fsegurai/codemirror-themes/tree/51238e12fe/packages/high-contrast-dark
 * License: https://opensource.org/licenses/MIT
 */

const { EditorView, HighlightStyle, syntaxHighlighting, tags } = require( 'ext.CodeMirror.lib' );

// Base colors - Pure black and white for maximum contrast
const base00 = '#000000', // Background - pure black
	base03 = '#808080', // Comments - medium grey
	base04 = '#b0b0b0', // Dark grey
	base05 = '#ffffff', // Foreground - pure white
	// High contrast accent colors
	brightYellow = '#ffff00',
	brightCyan = '#00ffff',
	brightGreen = '#00ff00',
	brightRed = '#ff0000',
	brightMagenta = '#ff00ff',
	brightBlue = '#0099ff',
	brightOrange = '#ff9900',
	brightPurple = '#cc66ff';
// UI specific colors
const invalid = brightRed,
	background = base00,
	tooltipBackground = '#1a1a1a',
	selection = '#264f78',
	selectionMatch = '#264f7880',
	cursor = brightYellow,
	activeBracketBg = '#1f1f1f',
	activeBracketBorder = brightCyan,
	diagnosticWarning = brightYellow,
	linkColor = brightCyan,
	visitedLinkColor = brightMagenta;

/**
 * Enhanced editor theme styles for High Contrast Dark
 */
const highContrastDarkTheme = EditorView.theme( {
	// Base editor styles
	'&': {
		color: base05,
		backgroundColor: background,
		border: `1px solid ${ base04 }`
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
		backgroundColor: '#3a5a8a',
		outline: `2px solid ${ brightCyan }`
	},
	// Search functionality
	'.cm-searchMatch': {
		backgroundColor: '#006400',
		outline: `2px solid ${ brightGreen }`,
		color: base05,
		'& span': {
			color: base05
		}
	},
	'.cm-searchMatch.cm-searchMatch-selected': {
		backgroundColor: brightGreen,
		color: base00,
		outline: `2px solid ${ base05 }`,
		'& span': {
			color: base00
		}
	},
	// Line highlighting
	'.cm-activeLine': {
		backgroundColor: '#2a2a2aa6',
		borderLeft: `3px solid ${ brightCyan }`,
		borderRight: `1px solid ${ base04 }`,
		zIndex: 1
	},
	// Tooltips and autocomplete
	'.cm-tooltip': {
		backgroundColor: tooltipBackground,
		border: `2px solid ${ brightCyan }`,
		color: base05
	},
	'.cm-tooltip-autocomplete': {
		'& > ul': {
			backgroundColor: tooltipBackground,
			border: `1px solid ${ base04 }`
		},
		'& > ul > li[aria-selected]': {
			backgroundColor: selection,
			color: brightYellow,
			border: `1px solid ${ brightCyan }`
		},
		'& > ul > li > span.cm-completionIcon': {
			color: brightCyan
		},
		'& > ul > li > span.cm-completionDetail': {
			color: brightYellow,
			fontStyle: 'italic'
		}
	},
	'.cm-tooltip .cm-tooltip-arrow:before': {
		borderTopColor: 'transparent',
		borderBottomColor: 'transparent'
	},
	'.cm-tooltip .cm-tooltip-arrow:after': {
		borderTopColor: brightCyan,
		borderBottomColor: brightCyan
	},
	// Diagnostics styling
	'.cm-diagnostic': {
		'&-error': {
			borderLeft: `4px solid ${ brightRed }`,
			backgroundColor: '#33000020'
		},
		'&-warning': {
			borderLeft: `4px solid ${ diagnosticWarning }`,
			backgroundColor: '#33330020'
		},
		'&-info': {
			borderLeft: `4px solid ${ linkColor }`,
			backgroundColor: '#00333320'
		}
	},
	// Matching brackets
	'.cm-matchingBracket, &.cm-focused .cm-matchingBracket': {
		backgroundColor: activeBracketBg,
		outline: `2px solid ${ activeBracketBorder }`
	},
	'.cm-nonmatchingBracket, &.cm-focused .cm-nonmatchingBracket': {
		backgroundColor: '#33000050',
		outline: `2px solid ${ invalid }`
	},
	// Selection matches
	'.cm-selectionMatch': {
		backgroundColor: selectionMatch,
		outline: `2px solid ${ brightCyan }50`
	},
	// Fold placeholder
	'.cm-foldPlaceholder': {
		backgroundColor: tooltipBackground,
		color: brightCyan,
		border: `2px solid ${ brightCyan }`
	}
}, { dark: true } );
/**
 * Enhanced syntax highlighting for High Contrast Dark theme
 */
const highContrastDarkHighlightStyle = HighlightStyle.define( [
	// Keywords and control flow
	{ tag: tags.keyword, color: brightMagenta, fontWeight: 'bold' },
	{ tag: tags.controlKeyword, color: brightMagenta, fontWeight: 'bold' },
	{ tag: tags.moduleKeyword, color: brightMagenta, fontWeight: 'bold' },
	// Names and variables
	{ tag: [ tags.name, tags.deleted, tags.character, tags.macroName ], color: base05 },
	{ tag: [ tags.variableName ], color: base05 },
	{ tag: [ tags.propertyName ], color: brightCyan, fontStyle: 'normal' },
	// Classes and types
	{ tag: [ tags.typeName ], color: brightYellow },
	{ tag: [ tags.className ], color: brightYellow, fontStyle: 'italic' },
	{ tag: [ tags.namespace ], color: brightOrange, fontStyle: 'italic' },
	// Operators and punctuation
	{ tag: [ tags.operator, tags.operatorKeyword ], color: brightCyan },
	{ tag: [ tags.bracket ], color: brightYellow },
	{ tag: [ tags.brace ], color: brightCyan },
	{ tag: [ tags.punctuation ], color: base05 },
	// Functions and parameters
	{ tag: [ tags.function( tags.variableName ), tags.labelName ], color: brightBlue },
	{ tag: [ tags.definition( tags.function( tags.variableName ) ) ], color: brightBlue },
	{ tag: [ tags.definition( tags.variableName ) ], color: brightOrange },
	// Constants and literals
	{ tag: tags.number, color: brightOrange },
	{ tag: tags.changed, color: brightYellow },
	{ tag: tags.annotation, color: brightRed, fontStyle: 'italic' },
	{ tag: tags.modifier, color: brightPurple, fontStyle: 'italic' },
	{ tag: tags.self, color: brightRed },
	{
		tag: [ tags.color, tags.constant( tags.name ), tags.standard( tags.name ) ],
		color: brightOrange
	},
	{ tag: [ tags.atom, tags.bool, tags.special( tags.variableName ) ], color: brightOrange },
	// Strings and regex
	{ tag: [ tags.processingInstruction, tags.inserted ], color: brightGreen },
	{ tag: [ tags.special( tags.string ), tags.regexp ], color: brightMagenta },
	{ tag: tags.string, color: brightGreen },
	// Punctuation and structure
	{ tag: tags.definition( tags.typeName ), color: brightYellow, fontWeight: 'bold' },
	{ tag: [ tags.definition( tags.name ), tags.separator ], color: brightCyan },
	// Comments and documentation
	{ tag: tags.meta, color: base03 },
	{ tag: tags.comment, fontStyle: 'italic', color: base03 },
	{ tag: tags.docComment, fontStyle: 'italic', color: base03 },
	// HTML/XML elements
	{ tag: [ tags.tagName ], color: brightMagenta },
	{ tag: [ tags.attributeName ], color: brightYellow },
	// Markdown and text formatting
	{ tag: [ tags.heading ], fontWeight: 'bold', color: brightMagenta },
	{ tag: [ tags.strong ], fontWeight: 'bold', color: brightOrange },
	{ tag: [ tags.emphasis ], fontStyle: 'italic', color: brightMagenta },
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
		color: brightRed,
		borderBottom: `2px dotted ${ brightRed }`
	},
	{ tag: [ tags.strikethrough ], color: brightRed, textDecoration: 'line-through' },
	// Enhanced syntax highlighting
	{ tag: tags.constant( tags.name ), color: brightOrange },
	{ tag: tags.deleted, color: brightRed },
	{ tag: tags.squareBracket, color: brightYellow },
	{ tag: tags.angleBracket, color: brightCyan },
	// Additional specific styles
	{ tag: tags.monospace, color: brightBlue, fontStyle: 'italic' },
	{ tag: [ tags.contentSeparator ], color: brightPurple },
	{ tag: tags.quote, color: brightPurple }
] );
/**
 * Combined High Contrast Dark theme extension
 */
const highContrastDark = [
	highContrastDarkTheme,
	syntaxHighlighting( highContrastDarkHighlightStyle )
];

module.exports = highContrastDark;
