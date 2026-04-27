/**
 * Forked from https://github.com/fsegurai/codemirror-themes/tree/51238e12fe/packages/basic-light
 * License: https://opensource.org/licenses/MIT
 */

const { EditorView, HighlightStyle, syntaxHighlighting, tags } = require( 'ext.CodeMirror.lib' );

// Text colors (dark shades)
const base00 = '#1c2434', //  deep navy - primary text (darker for better contrast)
	base01 = '#2d3748', //  dark slate - secondary text, cursor
	base03 = '#718096', //  steel blue - comments, panel text
	// Background shades
	base05 = '#f7fafc', // off-white - tooltip background
	// Primary accent colors (cool tones)
	base07 = '#0c7792', //  teal - links, braces (more saturated)
	base08 = '#0369a1', //  azure blue - numbers, constants (deeper)
	base09 = '#2b6cb0', //  royal blue - variables, parameters
	base0A = '#1a365d', //  deep navy - keywords, headings
	// Secondary accent colors (warm and complementary)
	base0B = '#c53030', //  red - square brackets (more vibrant)
	base0C = '#dd6b20', //  orange - strings (warmer, more vibrant)
	base0D = '#d69e2e', //  amber - class names (more saturated)
	base0E = '#2f855a', //  green - operators (deeper, richer)
	base0F = '#805ad5'; //  purple - tag names (more vibrant)
// UI-specific colors
const invalid = '#e53e3e', //  bright red - errors (more visible)
	highlightBackground = '#ebf4ff40', // active line highlight (subtle blue)
	background = '#ffffff', // editor background
	tooltipBackground = base05, // tooltip background
	selection = '#90cdf480', // selection background (clearer blue)
	selectionMatch = '#63b3ed40', // selection match highlight
	cursor = base01, //  cursor color
	activeBracketBg = '#0c779220', // active bracket background (transparent teal)
	activeBracketBorder = base09;

/**
 * Enhanced editor theme styles for Basic Light
 */
const basicLightTheme = EditorView.theme( {
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
		backgroundColor: '#63b3ed40',
		outline: `1px solid ${ base09 }`,
		color: base00,
		'& span': {
			color: base00
		}
	},
	'.cm-searchMatch.cm-searchMatch-selected': {
		backgroundColor: '#63b3ed70',
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
		border: '1px solid #e2e8f0',
		boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
	},
	'.cm-tooltip-autocomplete': {
		'& > ul': {
			backgroundColor: tooltipBackground,
			border: 'none'
		},
		'& > ul > li[aria-selected]': {
			backgroundColor: '#0c779220',
			color: base00
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
			borderLeft: `3px solid ${ base0D }`
		},
		'&-info': {
			borderLeft: `3px solid ${ base07 }`
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
		outline: `1px solid ${ base09 }30`
	},
	// Fold placeholder
	'.cm-foldPlaceholder': {
		backgroundColor: 'transparent',
		color: base03,
		border: `1px dotted ${ base09 }50`
	}
}, { dark: false } );
/**
 * Enhanced syntax highlighting for the Basic Light theme
 */
const basicLightHighlightStyle = HighlightStyle.define( [
	// Keywords and control flow
	{ tag: tags.keyword, color: base0A, fontWeight: 'bold' },
	{ tag: tags.controlKeyword, color: base0A, fontWeight: 'bold' },
	{ tag: tags.moduleKeyword, color: base0A, fontWeight: 'bold' },
	// Names and variables
	{ tag: [ tags.name, tags.deleted, tags.character, tags.macroName ], color: base09 },
	{ tag: [ tags.variableName ], color: base09 },
	{ tag: [ tags.propertyName ], color: base09, fontStyle: 'normal' },
	// Classes and types
	{ tag: [ tags.typeName ], color: base0D },
	{ tag: [ tags.className ], color: base0D, fontStyle: 'italic' },
	{ tag: [ tags.namespace ], color: base09, fontStyle: 'italic' },
	// Operators and punctuation
	{ tag: [ tags.operator, tags.operatorKeyword ], color: base0E },
	{ tag: [ tags.bracket ], color: base07 },
	{ tag: [ tags.brace ], color: base07 },
	{ tag: [ tags.punctuation ], color: base07 },
	// Functions and parameters
	{ tag: [ tags.function( tags.variableName ), tags.labelName ], color: base08 },
	{ tag: [ tags.definition( tags.variableName ) ], color: base09 },
	// Constants and literals
	{ tag: tags.number, color: base08 },
	{ tag: tags.changed, color: base08 },
	{ tag: tags.annotation, color: invalid, fontStyle: 'italic' },
	{ tag: tags.modifier, color: base08, fontStyle: 'italic' },
	{ tag: tags.self, color: base08 },
	{ tag: [ tags.color, tags.constant( tags.name ), tags.standard( tags.name ) ], color: base0A },
	{ tag: [ tags.atom, tags.bool, tags.special( tags.variableName ) ], color: base0C },
	// Strings and regex
	{ tag: [ tags.processingInstruction, tags.inserted ], color: base07 },
	{ tag: [ tags.special( tags.string ), tags.regexp ], color: base0B },
	{ tag: tags.string, color: base0C },
	// Punctuation and structure
	{ tag: tags.definition( tags.typeName ), color: base0D, fontWeight: 'bold' },
	// Comments and documentation
	{ tag: tags.meta, color: base08 },
	{ tag: tags.comment, fontStyle: 'italic', color: base03 },
	{ tag: tags.docComment, fontStyle: 'italic', color: base03 },
	// HTML/XML elements
	{ tag: [ tags.tagName ], color: base0F },
	{ tag: [ tags.attributeName ], color: base0D },
	// Markdown and text formatting
	{ tag: [ tags.heading ], fontWeight: 'bold', color: base08 },
	{ tag: [ tags.strong ], fontWeight: 'bold', color: base09 },
	{ tag: [ tags.emphasis ], fontStyle: 'italic', color: base0A },
	// Links and URLs
	{
		tag: [ tags.link ],
		color: base07,
		fontWeight: '500',
		textDecoration: 'underline',
		textUnderlinePosition: 'under'
	},
	{
		tag: [ tags.url ],
		color: base0C,
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
	{ tag: tags.constant( tags.name ), color: base0A },
	{ tag: tags.deleted, color: invalid },
	{ tag: tags.squareBracket, color: base0B },
	{ tag: tags.angleBracket, color: base0C },
	// Additional specific styles
	{ tag: tags.heading1, fontWeight: 'bold', color: base08 },
	{ tag: tags.special( tags.heading1 ), fontWeight: 'bold', color: base08 },
	{
		tag: [ tags.heading2, tags.heading3, tags.heading4 ],
		fontWeight: 'bold',
		color: base08
	},
	{ tag: [ tags.heading5, tags.heading6 ], color: base08 },
	{ tag: tags.monospace, color: base00 },
	{ tag: [ tags.contentSeparator ], color: base0D },
	{ tag: tags.quote, color: base01 }
] );
/**
 * Combined Basic Light theme extension
 */
const basicLight = [
	basicLightTheme,
	syntaxHighlighting( basicLightHighlightStyle )
];

module.exports = basicLight;
