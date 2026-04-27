/**
 * Forked from https://github.com/fsegurai/codemirror-themes/tree/51238e12fe/packages/github-dark
 * License: https://opensource.org/licenses/MIT
 */

const { EditorView, HighlightStyle, syntaxHighlighting, tags } = require( 'ext.CodeMirror.lib' );

// Core UI colors
const base00 = '#0d1117', // Background (GitHub dark mode background)
	base01 = '#c9d1d9', // Foreground (main text color)
	base02 = '#264F78', // Selection - brighter blue for better visibility
	base03 = '#8b949e', // Comment and Bracket color
	base04 = '#ffffff', // Caret color (pure white for better visibility,
	// Syntax highlighting colors
	base05 = '#7ee787', // TagName, Name, Quote - signature GitHub green
	base06 = '#d2a8ff', // ClassName, PropertyName - GitHub purple
	base07 = '#79c0ff', // VariableName, Number - GitHub blue
	base08 = '#ff7b72', // Keyword, TypeName - GitHub red
	base09 = '#a5d6ff', // String, Meta, Regexp - lighter blue
	base0C = '#ffab70', // Atom, Bool - GitHub orange
	// Background variants
	base0E = '#30363d'; // Panel and tooltip border color
// UI-specific colors
const invalid = '#f97583', // Invalid color - error red
	highlightBackground = '#2d333b1a', // Line highlight (GitHub selection color)
	tooltipBackground = '#21262d', // Tooltip background
	cursor = base04, // Caret color
	selection = base02, // Selection color
	activeBracketBg = '#3a587a75', // Active bracket background
	activeBracketBorder = '#4d90fe', // Active bracket border
	diagnosticWarning = '#d29922', // Warning color
	selectionMatch = '#3a587a55', // Selection match background
	linkColor = '#58a6ff', // Bright blue for links (GitHub link color)
	visitedLinkColor = '#bc8cff'; // Light purple for visited links

/**
 * Enhanced editor theme styles for GitHub Dark
 */
const githubDarkTheme = EditorView.theme( {
	// Base editor styles
	'&': {
		color: base01,
		backgroundColor: base00
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
		backgroundColor: '#3a587a',
		outline: `1px solid ${ base07 }`,
		color: base01,
		'& span': {
			color: base01
		}
	},
	'.cm-searchMatch.cm-searchMatch-selected': {
		backgroundColor: activeBracketBorder,
		color: base04,
		'& span': {
			color: base04
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
		border: `1px solid ${ base0E }`,
		boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
	},
	'.cm-tooltip-autocomplete': {
		'& > ul': {
			backgroundColor: tooltipBackground,
			border: 'none'
		},
		'& > ul > li[aria-selected]': {
			backgroundColor: selection,
			color: base04
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
		backgroundColor: '#f9758340',
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
		border: `1px dotted ${ base0E }70`
	}
}, { dark: true } );
/**
 * Enhanced syntax highlighting for GitHub Dark theme
 */
const githubDarkHighlightStyle = HighlightStyle.define( [
	// Keywords and control flow
	{ tag: tags.keyword, color: base08, fontWeight: 'bold' },
	{ tag: tags.controlKeyword, color: base08, fontWeight: 'bold' },
	{ tag: tags.moduleKeyword, color: base08, fontWeight: 'bold' },
	// Names and variables
	{ tag: [ tags.name, tags.deleted, tags.character, tags.macroName ], color: base07 },
	{ tag: [ tags.variableName ], color: base07 },
	{ tag: [ tags.propertyName ], color: base06, fontStyle: 'normal' },
	// Classes and types
	{ tag: [ tags.typeName ], color: base08 },
	{ tag: [ tags.className ], color: base06, fontStyle: 'italic' },
	{ tag: [ tags.namespace ], color: base07, fontStyle: 'italic' },
	// Operators and punctuation
	{ tag: [ tags.operator, tags.operatorKeyword ], color: base01 },
	{ tag: [ tags.bracket ], color: base03 },
	{ tag: [ tags.brace ], color: base03 },
	{ tag: [ tags.punctuation ], color: base03 },
	// Functions and parameters
	{ tag: [ tags.function( tags.variableName ), tags.labelName ], color: base05 },
	{ tag: [ tags.definition( tags.variableName ) ], color: base07 },
	// Constants and literals
	{ tag: tags.number, color: base0C },
	{ tag: tags.changed, color: base0C },
	{ tag: tags.annotation, color: invalid, fontStyle: 'italic' },
	{ tag: tags.modifier, color: base0C, fontStyle: 'italic' },
	{ tag: tags.self, color: base0C },
	{ tag: [ tags.color, tags.constant( tags.name ), tags.standard( tags.name ) ], color: base0C },
	{ tag: [ tags.atom, tags.bool, tags.special( tags.variableName ) ], color: base0C },
	// Strings and regex
	{ tag: [ tags.processingInstruction, tags.inserted ], color: base05 },
	{ tag: [ tags.special( tags.string ), tags.regexp ], color: base09 },
	{ tag: tags.string, color: base09 },
	// Punctuation and structure
	{ tag: tags.definition( tags.typeName ), color: base08, fontWeight: 'bold' },
	// Comments and documentation
	{ tag: tags.meta, color: base03 },
	{ tag: tags.comment, fontStyle: 'italic', color: base03 },
	{ tag: tags.docComment, fontStyle: 'italic', color: base03 },
	// HTML/XML elements
	{ tag: [ tags.tagName ], color: base05 },
	{ tag: [ tags.attributeName ], color: base06 },
	// Markdown and text formatting
	{ tag: [ tags.heading ], fontWeight: 'bold', color: base07 },
	{ tag: [ tags.strong ], fontWeight: 'bold', color: base07 },
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
	{ tag: tags.constant( tags.name ), color: base0C },
	{ tag: tags.deleted, color: invalid },
	{ tag: tags.squareBracket, color: base03 },
	{ tag: tags.angleBracket, color: base03 },
	// Additional specific styles
	{ tag: tags.monospace, color: base01 },
	{ tag: [ tags.contentSeparator ], color: base07 },
	{ tag: tags.quote, color: base03 }
] );
/**
 * Combined GitHub Dark theme extension
 */
const githubDark = [
	githubDarkTheme,
	syntaxHighlighting( githubDarkHighlightStyle )
];

module.exports = githubDark;
