/**
 * Forked from https://github.com/fsegurai/codemirror-themes/tree/51238e12fe/packages/vscode-light
 * License: https://opensource.org/licenses/MIT
 */

const { EditorView, HighlightStyle, syntaxHighlighting, tags } = require( 'ext.CodeMirror.lib' );

// Base colors
const base00 = '#ffffff', // Background
	base01 = '#f3f3f3', // Lighter background (popups, statuslines)
	base02 = '#d6d6d6', // Selection background
	base03 = '#6b6b6b', // Comments, invisibles
	base04 = '#000000', // Cursor color
	base05 = '#383a42', // Default foreground
	base06 = '#1f1f1f', // Dark foreground
	// Accent colors
	base08 = '#0064ff', // Keywords, storage
	base09 = '#af00db', // Control keywords, operators
	base0A = '#0070c1', // Variables, parameters
	base0B = '#267f99', // Classes, types
	base0C = '#795e26', // Functions, attributes
	base0D = '#098658', // Numbers, constants
	base0E = '#a31515', // Strings
	base0F = '#e51400', // Errors, invalid
	base10 = '#795e26', // Modified elements
	base11 = '#008000'; // Comments
// UI specific colors
const invalid = base0F,
	highlightBackground = '#99999926', // Line highlight with transparency
	background = base00,
	tooltipBackground = base01,
	selection = '#add6ff', // Selection background
	selectionMatch = '#a8ac9480', // Selection match background with transparency
	cursor = base04, // Cursor color
	activeBracketBg = '#007acc20', // Active bracket background with transparency
	activeBracketBorder = '#007acc', // Active bracket border
	diagnosticWarning = '#bf8803', // Warning color
	linkColor = '#006ab1', // Link color
	visitedLinkColor = '#9e46d0'; // Visited link color

/**
 * Enhanced editor theme styles for VSCode Light
 */
const vsCodeLightTheme = EditorView.theme( {
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
		backgroundColor: '#bbdefb',
		outline: `1px solid ${ base0A }90`,
		color: base06
	},
	'.cm-searchMatch.cm-searchMatch-selected': {
		backgroundColor: '#90caf9',
		color: base06,
		'& span': {
			color: base06
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
		border: `1px solid ${ base02 }`,
		boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
	},
	'.cm-tooltip-autocomplete': {
		'& > ul': {
			backgroundColor: tooltipBackground,
			border: 'none'
		},
		'& > ul > li[aria-selected]': {
			backgroundColor: '#dcebfc',
			color: base06
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
		backgroundColor: `${ base0F }20`,
		outline: `1px solid ${ invalid }`
	},
	// Selection matches
	'.cm-selectionMatch': {
		backgroundColor: selectionMatch,
		outline: `1px solid ${ base02 }70`
	},
	// Fold placeholder
	'.cm-foldPlaceholder': {
		backgroundColor: tooltipBackground,
		color: base03,
		border: `1px dotted ${ base03 }70`
	}
}, { dark: false } );
/**
 * Enhanced syntax highlighting for VSCode Light theme
 */
const vsCodeLightHighlightStyle = HighlightStyle.define( [
	// Keywords and control flow
	{ tag: tags.keyword, color: base08, fontWeight: 'bold' },
	{ tag: tags.controlKeyword, color: base09, fontWeight: 'bold' },
	{ tag: tags.moduleKeyword, color: base08, fontWeight: 'bold' },
	// Names and variables
	{ tag: [ tags.name, tags.deleted, tags.character, tags.macroName ], color: base05 },
	{ tag: [ tags.variableName ], color: base0A },
	{ tag: [ tags.propertyName ], color: base0A, fontStyle: 'normal' },
	// Classes and types
	{ tag: [ tags.typeName ], color: base0B },
	{ tag: [ tags.className ], color: base0B, fontStyle: 'normal' },
	{ tag: [ tags.namespace ], color: base05, fontStyle: 'normal' },
	// Operators and punctuation
	{ tag: [ tags.operator, tags.operatorKeyword ], color: base05 },
	{ tag: [ tags.bracket ], color: base05 },
	{ tag: [ tags.brace ], color: base05 },
	{ tag: [ tags.punctuation ], color: base05 },
	// Functions and parameters
	{ tag: [ tags.function( tags.variableName ) ], color: base0C },
	{ tag: [ tags.labelName ], color: base0C, fontStyle: 'normal' },
	{ tag: [ tags.definition( tags.function( tags.variableName ) ) ], color: base0C },
	{ tag: [ tags.definition( tags.variableName ) ], color: base0A },
	// Constants and literals
	{ tag: tags.number, color: base0D },
	{ tag: tags.changed, color: base10 },
	{ tag: tags.annotation, color: base10, fontStyle: 'italic' },
	{ tag: tags.modifier, color: base08, fontStyle: 'normal' },
	{ tag: tags.self, color: base08 },
	{
		tag: [ tags.color, tags.constant( tags.name ), tags.standard( tags.name ) ],
		color: base0A
	},
	{ tag: [ tags.atom, tags.bool, tags.special( tags.variableName ) ], color: base08 },
	// Strings and regex
	{ tag: [ tags.processingInstruction, tags.inserted ], color: base0E },
	{ tag: [ tags.special( tags.string ), tags.regexp ], color: base09 },
	{ tag: tags.string, color: base0E },
	// Punctuation and structure
	{ tag: tags.definition( tags.typeName ), color: base0B, fontWeight: 'bold' },
	{ tag: [ tags.definition( tags.name ), tags.separator ], color: base05 },
	// Comments and documentation
	{ tag: tags.meta, color: base03 },
	{ tag: tags.comment, fontStyle: 'italic', color: base11 },
	{ tag: tags.docComment, fontStyle: 'italic', color: base11 },
	// HTML/XML elements
	{ tag: [ tags.tagName ], color: base08 },
	{ tag: [ tags.attributeName ], color: base0A },
	// Markdown and text formatting
	{ tag: [ tags.heading ], fontWeight: 'bold', color: base08 },
	{ tag: tags.heading1, color: base08, fontWeight: 'bold' },
	{ tag: tags.heading2, color: base08 },
	{ tag: tags.heading3, color: base08 },
	{ tag: tags.heading4, color: base08 },
	{ tag: tags.heading5, color: base08 },
	{ tag: tags.heading6, color: base08 },
	{ tag: [ tags.strong ], fontWeight: 'bold', color: base08 },
	{ tag: [ tags.emphasis ], fontStyle: 'italic', color: base0A },
	// Links and URLs
	{
		tag: [ tags.link ],
		color: visitedLinkColor,
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
	{ tag: tags.constant( tags.name ), color: base0A },
	{ tag: tags.deleted, color: invalid },
	{ tag: tags.squareBracket, color: base05 },
	{ tag: tags.angleBracket, color: base05 },
	// Additional specific styles
	{ tag: tags.monospace, color: base05 },
	{ tag: [ tags.contentSeparator ], color: base05 },
	{ tag: tags.quote, color: base11 }
] );
/**
 * Combined VSCode Light theme extension
 */
const vsCodeLight = [
	vsCodeLightTheme,
	syntaxHighlighting( vsCodeLightHighlightStyle )
];

module.exports = vsCodeLight;
