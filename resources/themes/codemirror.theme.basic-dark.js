/**
 * Forked from https://github.com/fsegurai/codemirror-themes/tree/51238e12fe/packages/basic-dark
 * License: https://opensource.org/licenses/MIT
 */

const { EditorView, HighlightStyle, syntaxHighlighting, tags } = require( 'ext.CodeMirror.lib' );

// Base colors
const base00 = '#1e2124', // Background (slightly darker for better contrast)
	base01 = '#e2e2e2', // Foreground (slightly brighter for better readability)
	base02 = '#5c88da', // Selection elements (more vibrant blue)
	base04 = '#ffffff', // Cursor (pure white for better visibility)
	base06 = '#909090', // Comments (slightly more visible gray)
	base07 = '#000000', // Pure black for contrast elements
	base08 = '#e06c75', // Error, deleted (more vibrant red)
	base09 = '#f39c12', // Number, boolean (warmer orange)
	base0A = '#ffcb6b', // Keywords (warmer yellow)
	base0B = '#98c379', // Strings (more vibrant green)
	base0C = '#56b6c2', // Classes, types (cyan blue)
	base0D = '#61afef', // Functions, methods (bright blue)
	base0E = '#c678dd', // Operators, brackets (brighter purple)
	base0F = '#be5046', // Special elements (darker red)
	// UI-specific colors
	invalid = '#e06c75', // Error highlighting (consistent red)
	selectionBackground = '#3a5991aa', // Selection background (semi-transparent blue)
	highlightBackground = '#3a3d4166', // Active line background (subtle blue-gray)
	tooltipBackground = '#2a2c31', // Tooltip background (darker than the editor)
	cursor = base04,
	activeBracketBg = '#3a599140',
	activeBracketBorder = base0E;

/**
 * Enhanced editor theme styles for Basic Dark
 */
const basicDarkTheme = EditorView.theme( {
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
		backgroundColor: selectionBackground
	},
	// Search functionality
	'.cm-searchMatch': {
		backgroundColor: '#4a74c480',
		outline: `1px solid ${ base02 }`,
		color: base01,
		'& span': {
			color: base01
		}
	},
	'.cm-searchMatch.cm-searchMatch-selected': {
		backgroundColor: '#5c88da90',
		color: base01,
		'& span': {
			color: base01
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
		border: '1px solid #3a3a3a',
		boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
	},
	'.cm-tooltip-autocomplete': {
		'& > ul': {
			backgroundColor: tooltipBackground,
			border: 'none'
		},
		'& > ul > li[aria-selected]': {
			backgroundColor: selectionBackground,
			color: base01
		},
		'& > ul > li > span.cm-completionIcon': {
			color: base06
		},
		'& > ul > li > span.cm-completionDetail': {
			color: base06,
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
			borderLeft: `3px solid ${ base0A }`
		},
		'&-info': {
			borderLeft: `3px solid ${ base0D }`
		}
	},
	// Matching brackets
	'.cm-matchingBracket, &.cm-focused .cm-matchingBracket': {
		backgroundColor: activeBracketBg,
		outline: `1px solid ${ activeBracketBorder }60`
	},
	'.cm-nonmatchingBracket, &.cm-focused .cm-nonmatchingBracket': {
		backgroundColor: '#e06c7540',
		outline: `1px solid ${ invalid }`
	},
	// Selection matches
	'.cm-selectionMatch': {
		backgroundColor: '#4a74c440',
		outline: `1px solid ${ base02 }50`
	},
	// Fold placeholder
	'.cm-foldPlaceholder': {
		backgroundColor: 'transparent',
		color: base02,
		border: `1px dotted ${ base02 }70`
	}
}, { dark: true } );

/**
 * Enhanced syntax highlighting for Basic Dark theme
 */
const basicDarkHighlightStyle = HighlightStyle.define( [
	// Keywords and control flow
	{ tag: tags.keyword, color: base0A, fontWeight: 'bold' },
	{ tag: tags.controlKeyword, color: base0A, fontWeight: 'bold' },
	{ tag: tags.moduleKeyword, color: base0A, fontWeight: 'bold' },
	// Names and variables
	{ tag: [ tags.name, tags.deleted, tags.character, tags.macroName ], color: base0D },
	{ tag: [ tags.variableName ], color: base0D },
	{ tag: [ tags.propertyName ], color: base0C, fontStyle: 'normal' },
	// Classes and types
	{ tag: [ tags.typeName ], color: base0C },
	{ tag: [ tags.className ], color: base0C, fontStyle: 'italic' },
	{ tag: [ tags.namespace ], color: base0D, fontStyle: 'italic' },
	// Operators and punctuation
	{ tag: [ tags.operator, tags.operatorKeyword ], color: base0E },
	{ tag: [ tags.bracket ], color: base0E },
	{ tag: [ tags.brace ], color: base0E },
	{ tag: [ tags.punctuation ], color: base0E },
	// Functions and parameters
	{ tag: [ tags.function( tags.variableName ), tags.labelName ], color: base0D },
	{ tag: [ tags.definition( tags.variableName ) ], color: base0D },
	// Constants and literals
	{ tag: tags.number, color: base09 },
	{ tag: tags.changed, color: base09 },
	{ tag: tags.annotation, color: invalid, fontStyle: 'italic' },
	{ tag: tags.modifier, color: base09, fontStyle: 'italic' },
	{ tag: tags.self, color: base09 },
	{ tag: [ tags.color, tags.constant( tags.name ), tags.standard( tags.name ) ], color: base09 },
	{ tag: [ tags.atom, tags.bool, tags.special( tags.variableName ) ], color: base09 },
	// Strings and regex
	{ tag: [ tags.processingInstruction, tags.inserted ], color: base0B },
	{ tag: [ tags.special( tags.string ), tags.regexp ], color: base0B },
	{ tag: tags.string, color: base0B },
	// Punctuation and structure
	{ tag: tags.definition( tags.typeName ), color: base0C, fontWeight: 'bold' },
	// Comments and documentation
	{ tag: tags.meta, color: base08 },
	{ tag: tags.comment, fontStyle: 'italic', color: base06 },
	{ tag: tags.docComment, fontStyle: 'italic', color: base06 },
	// HTML/XML elements
	{ tag: [ tags.tagName ], color: base0A },
	{ tag: [ tags.attributeName ], color: base0D },
	// Markdown and text formatting
	{ tag: [ tags.heading ], fontWeight: 'bold', color: base0A },
	{
		tag: [ tags.strong ],
		fontWeight: 'bold',
		color: base09,
		textShadow: `0 0 2px ${ base07 }`
	},
	{ tag: [ tags.emphasis ], fontStyle: 'italic', color: base0D },
	// Links and URLs
	{
		tag: [ tags.link ],
		color: base0F,
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
		color: invalid,
		borderBottom: `1px dotted ${ invalid }`
	},
	{ tag: [ tags.strikethrough ], color: invalid, textDecoration: 'line-through' },
	// Enhanced syntax highlighting
	{ tag: tags.constant( tags.name ), color: base09 },
	{ tag: tags.deleted, color: invalid },
	{ tag: tags.squareBracket, color: base0E },
	{ tag: tags.angleBracket, color: base0E },
	// Additional specific styles
	{ tag: tags.monospace, color: base01 },
	{ tag: [ tags.contentSeparator ], color: base0D },
	{ tag: tags.quote, color: base06 }
] );

/**
 * Combined Basic Dark theme extension
 */
const basicDark = [
	basicDarkTheme,
	syntaxHighlighting( basicDarkHighlightStyle )
];

module.exports = basicDark;
