/**
 * Forked from https://github.com/fsegurai/codemirror-themes/tree/51238e12fe/packages/github-light
 * License: https://opensource.org/licenses/MIT
 */

const { EditorView, HighlightStyle, syntaxHighlighting, tags } = require( 'ext.CodeMirror.lib' );

// Core UI colors
const base00 = '#ffffff', // Background (GitHub light mode background)
	base01 = '#24292e', // Foreground (main text color)
	base02 = '#BBDFFF', // Selection - light blue
	base03 = '#6e7781', // Comments, subdued text
	// Syntax highlighting colors
	base05 = '#116329', // Tag names - GitHub green
	base06 = '#6a737d', // Comments, brackets - GitHub gray
	base07 = '#6f42c1', // Classes, properties - GitHub purple
	base08 = '#005cc5', // Variables, attributes - GitHub blue
	base09 = '#d73a49', // Keywords, types - GitHub red
	base0A = '#032f62', // Strings, regexps - GitHub navy
	base0B = '#22863a', // Names, quotes - GitHub green
	base0C = '#e36209', // Atoms, booleans - GitHub orange
	// Background variants
	base0E = '#e1e4e8', // Panel and tooltip border color
	base0F = '#f8f9fa'; // Tooltip background
// Special states
const invalid = '#cb2431', // Invalid color - error red
	highlightBackground = '#BBDFFF20', // Line highlight (light blue and opacity)
	tooltipBackground = base0F, // Tooltip background
	cursor = base01, // Caret color
	selection = base02, // Selection color
	activeBracketBg = '#e8f0fe', // Active bracket background
	activeBracketBorder = '#0366d6', // Active bracket border
	diagnosticWarning = '#b08800', // Warning color
	selectionMatch = '#79b8ff40', // Selection match background
	linkColor = '#0969da', // Bright blue for links
	visitedLinkColor = '#8250df'; // Purple for visited links

/**
 * Enhanced editor theme styles for GitHub Light
 */
const githubLightTheme = EditorView.theme( {
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
		backgroundColor: '#daebff',
		outline: `1px solid ${ base08 }`,
		color: base01,
		'& span': {
			color: base01
		}
	},
	'.cm-searchMatch.cm-searchMatch-selected': {
		backgroundColor: '#79b8ff',
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
		border: `1px solid ${ base0E }`,
		boxShadow: '0 1px 5px rgba(0, 0, 0, 0.1)'
	},
	'.cm-tooltip-autocomplete': {
		'& > ul': {
			backgroundColor: tooltipBackground,
			border: 'none'
		},
		'& > ul > li[aria-selected]': {
			backgroundColor: '#0366d630',
			color: base01
		},
		'& > ul > li:hover': {
			backgroundColor: '#0366d615'
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
		outline: `1px solid ${ activeBracketBorder }80`
	},
	'.cm-nonmatchingBracket, &.cm-focused .cm-nonmatchingBracket': {
		backgroundColor: '#ffeef080',
		outline: `1px solid ${ invalid }`
	},
	// Selection matches
	'.cm-selectionMatch': {
		backgroundColor: selectionMatch,
		outline: `1px solid ${ base02 }50`
	},
	// Fold placeholder
	'.cm-foldPlaceholder': {
		backgroundColor: selectionMatch,
		color: base03,
		border: `1px dotted ${ base0E }70`
	}
}, { dark: false } );
/**
 * Enhanced syntax highlighting for GitHub Light theme
 */
const githubLightHighlightStyle = HighlightStyle.define( [
	// Keywords and control flow
	{ tag: tags.keyword, color: base09, fontWeight: 'bold' },
	{ tag: tags.controlKeyword, color: base09, fontWeight: 'bold' },
	{ tag: tags.moduleKeyword, color: base09, fontWeight: 'bold' },
	// Names and variables
	{ tag: [ tags.name, tags.deleted, tags.character, tags.macroName ], color: base08 },
	{ tag: [ tags.variableName ], color: base08 },
	{ tag: [ tags.propertyName ], color: base07, fontStyle: 'normal' },
	// Classes and types
	{ tag: [ tags.typeName ], color: base09 },
	{ tag: [ tags.className ], color: base07, fontStyle: 'italic' },
	{ tag: [ tags.namespace ], color: base08, fontStyle: 'italic' },
	// Operators and punctuation
	{ tag: [ tags.operator, tags.operatorKeyword ], color: base01 },
	{ tag: [ tags.bracket ], color: base06 },
	{ tag: [ tags.brace ], color: base06 },
	{ tag: [ tags.punctuation ], color: base06 },
	// Functions and parameters
	{ tag: [ tags.function( tags.variableName ), tags.labelName ], color: base0B },
	{ tag: [ tags.definition( tags.variableName ) ], color: base08 },
	// Constants and literals
	{ tag: tags.number, color: base0C },
	{ tag: tags.changed, color: base0C },
	{ tag: tags.annotation, color: invalid, fontStyle: 'italic' },
	{ tag: tags.modifier, color: base0C, fontStyle: 'italic' },
	{ tag: tags.self, color: base0C },
	{ tag: [ tags.color, tags.constant( tags.name ), tags.standard( tags.name ) ], color: base0C },
	{ tag: [ tags.atom, tags.bool, tags.special( tags.variableName ) ], color: base0C },
	// Strings and regex
	{ tag: [ tags.processingInstruction, tags.inserted ], color: base0B },
	{ tag: [ tags.special( tags.string ), tags.regexp ], color: base0A },
	{ tag: tags.string, color: base0A },
	// Punctuation and structure
	{ tag: tags.definition( tags.typeName ), color: base09, fontWeight: 'bold' },
	// Comments and documentation
	{ tag: tags.meta, color: base06 },
	{ tag: tags.comment, fontStyle: 'italic', color: base06 },
	{ tag: tags.docComment, fontStyle: 'italic', color: base06 },
	// HTML/XML elements
	{ tag: [ tags.tagName ], color: base05 },
	{ tag: [ tags.attributeName ], color: base07 },
	// Markdown and text formatting
	{ tag: [ tags.heading ], fontWeight: 'bold', color: base08 },
	{ tag: [ tags.strong ], fontWeight: 'bold', color: base08 },
	{ tag: [ tags.emphasis ], fontStyle: 'italic', color: base0A },
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
	{ tag: tags.squareBracket, color: base06 },
	{ tag: tags.angleBracket, color: base06 },
	// Additional specific styles
	{ tag: tags.monospace, color: base01 },
	{ tag: [ tags.contentSeparator ], color: base08 },
	{ tag: tags.quote, color: base06 }
] );
/**
 * Combined GitHub Light theme extension
 */
const githubLight = [
	githubLightTheme,
	syntaxHighlighting( githubLightHighlightStyle )
];

module.exports = githubLight;
