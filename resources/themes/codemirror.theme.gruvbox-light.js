/**
 * Forked from https://github.com/fsegurai/codemirror-themes/tree/51238e12fe/packages/gruvbox-light
 * License: https://opensource.org/licenses/MIT
 */

const { EditorView, HighlightStyle, syntaxHighlighting, tags } = require( 'ext.CodeMirror.lib' );

// Gruvbox base colors
const base00 = '#3c3836', // Main foreground (text)
	base02 = '#665c54', // Tertiary foreground
	base03 = '#7c6f64', // Quaternary foreground
	base04 = '#928374', // Comments, invisibles, line highlighting
	// Light/background shades
	base05 = '#fbf1c7', // Main background
	base06 = '#ebdbb2', // Secondary background
	base08 = '#bdae93', // Quaternary background
	// Accent colors
	base0A = '#9d0006', // Keywords, storage, operator
	base0B = '#79740e', // Strings, tag attributes
	base0C = '#b57614', // Functions, tag names
	base0D = '#076678', // Variables
	base0E = '#8f3f71', // Numbers, special constants
	base0F = '#427b58', // Types
	base10 = '#af3a03'; // Cursor, constants
// UI specific colors
const invalid = base0A, darkBackground = base06, highlightBackground = '#ffc42e25', // Line highlight with transparency
	background = base05, tooltipBackground = base06, selection = darkBackground, selectionMatch = '#ffc42e40', // Selection match background
	cursor = base10, // Cursor color
	activeBracketBg = '#d5c4a180', // Active bracket background
	activeBracketBorder = base10, // Active bracket border
	diagnosticWarning = base0C, // Warning color
	linkColor = base0D, // Link color
	visitedLinkColor = base0E; // Visited link color

/**
 * Enhanced editor theme styles for Gruvbox Light
 */
const gruvboxLightTheme = EditorView.theme( {
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
		backgroundColor: '#ffc42e80',
		outline: `1px solid ${ base10 }`,
		color: base00,
		'& span': {
			color: base00
		}
	},
	'.cm-searchMatch.cm-searchMatch-selected': {
		backgroundColor: base10,
		color: base05,
		'& span': {
			color: base05
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
		border: `1px solid ${ base08 }`,
		boxShadow: '0 1px 5px rgba(0, 0, 0, 0.1)'
	},
	'.cm-tooltip-autocomplete': {
		'& > ul': {
			backgroundColor: tooltipBackground,
			border: 'none'
		},
		'& > ul > li[aria-selected]': {
			backgroundColor: base10 + '30',
			color: base00
		},
		'& > ul > li:hover': {
			backgroundColor: base10 + '15'
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
		backgroundColor: '#fb492740',
		outline: `1px solid ${ invalid }`
	},
	// Selection matches
	'.cm-selectionMatch': {
		backgroundColor: selectionMatch,
		outline: `1px solid ${ base08 }`
	},
	// Fold placeholder
	'.cm-foldPlaceholder': {
		backgroundColor: 'transparent',
		color: base02,
		border: `1px dotted ${ base08 }`
	}
}, { dark: false } );
/**
 * Enhanced syntax highlighting for Gruvbox Light theme
 */
const gruvboxLightHighlightStyle = HighlightStyle.define( [
	// Keywords and control flow
	{ tag: tags.keyword, color: base0A, fontWeight: 'bold' },
	{ tag: tags.controlKeyword, color: base0A, fontWeight: 'bold' },
	{ tag: tags.moduleKeyword, color: base0A, fontWeight: 'bold' },
	// Names and variables
	{ tag: [ tags.name, tags.deleted, tags.character, tags.macroName ], color: base0D },
	{ tag: [ tags.variableName ], color: base0D },
	{ tag: [ tags.propertyName ], color: base0F, fontStyle: 'normal' },
	// Classes and types
	{ tag: [ tags.typeName ], color: base0F },
	{ tag: [ tags.className ], color: base0C, fontStyle: 'italic' },
	{ tag: [ tags.namespace ], color: base0D, fontStyle: 'italic' },
	// Operators and punctuation
	{ tag: [ tags.operator, tags.operatorKeyword ], color: base00 },
	{ tag: [ tags.bracket ], color: base04 },
	{ tag: [ tags.brace ], color: base04 },
	{ tag: [ tags.punctuation ], color: base04 },
	// Functions and parameters
	{ tag: [ tags.function( tags.variableName ), tags.labelName ], color: base0C },
	{ tag: [ tags.definition( tags.variableName ) ], color: base0D },
	// Constants and literals
	{ tag: tags.number, color: base0E },
	{ tag: tags.changed, color: base0E },
	{ tag: tags.annotation, color: invalid, fontStyle: 'italic' },
	{ tag: tags.modifier, color: base0E, fontStyle: 'italic' },
	{ tag: tags.self, color: base0E },
	{ tag: [ tags.color, tags.constant( tags.name ), tags.standard( tags.name ) ], color: base10 },
	{ tag: [ tags.atom, tags.bool, tags.special( tags.variableName ) ], color: base10 },
	// Strings and regex
	{ tag: [ tags.processingInstruction, tags.inserted ], color: base0B },
	{ tag: [ tags.special( tags.string ), tags.regexp ], color: base0B },
	{ tag: tags.string, color: base0B },
	// Punctuation and structure
	{ tag: tags.definition( tags.typeName ), color: base0F, fontWeight: 'bold' },
	// Comments and documentation
	{ tag: tags.meta, color: base04 },
	{ tag: tags.comment, fontStyle: 'italic', color: base04 },
	{ tag: tags.docComment, fontStyle: 'italic', color: base04 },
	// HTML/XML elements
	{ tag: [ tags.tagName ], color: base0A },
	{ tag: [ tags.attributeName ], color: base0C },
	// Markdown and text formatting
	{ tag: [ tags.heading ], fontWeight: 'bold', color: base0C },
	{ tag: [ tags.strong ], fontWeight: 'bold', color: base0C },
	{ tag: [ tags.emphasis ], fontStyle: 'italic', color: base0B },
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
	{ tag: tags.constant( tags.name ), color: base10 },
	{ tag: tags.deleted, color: invalid },
	{ tag: tags.squareBracket, color: base04 },
	{ tag: tags.angleBracket, color: base04 },
	// Additional specific styles
	{ tag: tags.monospace, color: base00 },
	{ tag: [ tags.contentSeparator ], color: base0D },
	{ tag: tags.quote, color: base04 }
] );
/**
 * Combined Gruvbox Light theme extension
 */
const gruvboxLight = [
	gruvboxLightTheme,
	syntaxHighlighting( gruvboxLightHighlightStyle )
];

module.exports = gruvboxLight;
