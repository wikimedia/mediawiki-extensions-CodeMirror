require( './stubs.js' );

const {
	Compartment,
	Decoration,
	EditorView,
	defaultKeymap,
	drawSelection,
	history,
	historyKeymap,
	keymap,
	syntaxHighlighting
} = require( 'ext.CodeMirror.lib' );
const { CodeMirrorMediaWiki } = require( '../resources/modes/mediawiki/codemirror.mediawiki.js' );
const bracketMatching = require( '../resources/codemirror.matchbrackets.js' );
const mwConfig = require( './mwConfig.js' );

// The matching extensions get their own groups in VisualEditor, not a syntax- one, because
// their outline and bold are beyond what the Custom Highlight API can draw.
const HIGHLIGHT_GROUPS = {
	'cm-matchingBracket': 'visualeditor-matching-bracket',
	'cm-nonmatchingBracket': 'visualeditor-nonmatching-bracket'
};

// Heading sizes reach VisualEditor as a class on the line, because ::highlight() cannot set
// font-size. Mirrors HEADING_RE and SECTION_CLASS_PREFIX in codemirror.visualEditorHighlight.js.
const HEADING_RE = /^(={1,6}).+?\1[ \t]*$/;

const mode = new CodeMirrorMediaWiki( mwConfig );
const playgroundTheme = new Compartment();
const playgroundSections = new Compartment();
const renders = document.querySelectorAll( '.cm-doc-render' );
const dark = document.getElementById( 'cm-doc-dark' );
const theme = document.getElementById( 'cm-doc-theme' );
const visualEditor = document.getElementById( 'cm-doc-visualeditor' );
const grounds = document.getElementById( 'cm-doc-grounds' );
const groundNotes = {
	visualEditor: document.getElementById( 'cm-doc-grounds-visualEditor' ),
	noTints: document.getElementById( 'cm-doc-grounds-noTints' )
};
const themeNames = [ ...theme.options ].map( ( option ) => option.value );
const supportsHighlights = !!( window.CSS && CSS.highlights );

/**
 * CodeMirrorThemes makes the colour-blind palette a content class and `no-highlight` the absence
 * of the theme's own rules, both scoped by the editor class.
 *
 * @param {Element} element Takes the editor class.
 * @param {Element} content Takes the palette class.
 */
function applyThemeClasses( element, content ) {
	for ( const name of themeNames ) {
		element.classList.toggle( `cm-mw-theme-${ name }`, theme.value === name );
	}
	if ( content ) {
		content.classList.toggle( 'cm-mw-colorblind-colors', theme.value === 'colorblind' );
	}
}

/**
 * Heading lines, as a decoration rather than a class set on the DOM, so the editor knows the
 * line is taller and still puts the caret in the right place.
 */
const sectionDecorations = EditorView.decorations.compute( [ 'doc' ], ( state ) => {
	const decorations = [];
	for ( let i = 1; i <= state.doc.lines; i++ ) {
		const line = state.doc.line( i );
		const match = HEADING_RE.exec( line.text );
		if ( match ) {
			decorations.push(
				Decoration.line( { class: `cm-mw-ve-section-${ match[ 1 ].length }` } )
					.range( line.from )
			);
		}
	}
	return Decoration.set( decorations );
} );

/**
 * @return {Array} The editor and content classes CodeMirrorThemes applies on a wiki.
 */
function themeExtension() {
	return [
		// codemirror.less colours the caret on a wiki, but the VisualEditor switch turns it off.
		EditorView.darkTheme.of( dark.checked ),
		EditorView.editorAttributes.of( { class: `cm-mw-theme-${ theme.value }` } ),
		theme.value === 'colorblind' ?
			EditorView.contentAttributes.of( { class: 'cm-mw-colorblind-colors' } ) :
			[]
	];
}

const playground = new EditorView( {
	parent: document.getElementById( 'cm-doc-playground' ),
	doc: document.getElementById( 'cm-doc-playground' ).dataset.doc,
	extensions: [
		mode.language,
		syntaxHighlighting( mode.highlightStyle ),
		history(),
		drawSelection(),
		bracketMatching( mode.bracketMatchingConfig ),
		mode.bracketMatchingExtension,
		keymap.of( [ ...defaultKeymap, ...historyKeymap ] ),
		EditorView.lineWrapping,
		playgroundTheme.of( themeExtension() ),
		playgroundSections.of( [] ),
		EditorView.updateListener.of( ( update ) => {
			// Both matching extensions recompute on a selection change, and the viewport
			// decides which lines are in the DOM at all.
			if ( visualEditor.checked &&
				( update.docChanged || update.selectionSet || update.viewportChanged )
			) {
				refreshPlaygroundHighlights();
			}
		} )
	]
} );

/*
 * VisualEditor's source mode paints the same tokens through the CSS Custom Highlight API, which
 * supports only colour, background, text-decoration and text-shadow. Registering the tokens as
 * highlights shows what survives; the guard in editor-styles.less stops the ordinary rules from
 * painting them as well.
 *
 * The examples never change, so their ranges are registered once. Only the playground is
 * measured again, and only the ranges it contributed are replaced.
 */
const highlights = new Map();
let examplesRegistered = false;
let registeredTheme = null;
let playgroundRanges = [];

/**
 * @return {boolean} Whether the theme paints syntax colours. Mirrors
 *   CodeMirrorVisualEditorHighlight#syntaxHighlightingEnabled.
 */
function syntaxHighlightingEnabled() {
	return theme.value !== 'no-highlight';
}

/**
 * @param {string} className
 * @return {Highlight}
 */
function highlightFor( className ) {
	const name = HIGHLIGHT_GROUPS[ className ] || `visualeditor-syntax-${ className }`;
	if ( !highlights.has( name ) ) {
		const highlight = new window.Highlight();
		highlights.set( name, highlight );
		CSS.highlights.set( name, highlight );
	}
	return highlights.get( name );
}

/**
 * @param {string} selector
 * @param {Array} [added] Collects what was added, so it can be removed again later.
 */
function addRanges( selector, added ) {
	for ( const span of document.querySelectorAll( selector ) ) {
		for ( const className of span.classList ) {
			// The matching extensions have their own preferences, so they keep their colours
			// when the theme turns the syntax ones off.
			if ( !syntaxHighlightingEnabled() && !( className in HIGHLIGHT_GROUPS ) ) {
				continue;
			}
			const highlight = highlightFor( className );
			const range = document.createRange();
			range.selectNodeContents( span );
			highlight.add( range );
			if ( added ) {
				added.push( { highlight, range } );
			}
		}
	}
}

function refreshPlaygroundHighlights() {
	for ( const { highlight, range } of playgroundRanges ) {
		highlight.delete( range );
	}
	playgroundRanges = [];
	addRanges( '#cm-doc-playground .cm-line span[class]', playgroundRanges );
}

function applyVisualEditorHighlights() {
	if ( !supportsHighlights ) {
		return;
	}
	// The theme decides which classes are painted at all, so a change to it makes everything
	// registered so far wrong.
	if ( !visualEditor.checked || registeredTheme !== theme.value ) {
		CSS.highlights.clear();
		highlights.clear();
		playgroundRanges = [];
		examplesRegistered = false;
		registeredTheme = theme.value;
	}
	if ( !visualEditor.checked ) {
		return;
	}
	if ( !examplesRegistered ) {
		addRanges( '.cm-doc-render .cm-line span[class]' );
		examplesRegistered = true;
	}
	refreshPlaygroundHighlights();
}

/**
 * Marks heading lines in the examples the way VisualEditor's controller does. The playground
 * gets the same thing from sectionDecorations instead.
 */
function applyExampleSectionClasses() {
	for ( const line of document.querySelectorAll( '.cm-doc-render .cm-line' ) ) {
		for ( let level = 1; level <= 6; level++ ) {
			line.classList.remove( `cm-mw-ve-section-${ level }` );
		}
		const match = visualEditor.checked && syntaxHighlightingEnabled() &&
			HEADING_RE.exec( line.textContent );
		if ( match ) {
			line.classList.add( `cm-mw-ve-section-${ match[ 1 ].length }` );
		}
	}
}

/**
 * The swatches are empty elements, so only the DOM style sheets can tint them. VisualEditor
 * paints text ranges instead, and two of the themes have no tints at all.
 */
function applyGroundNotes() {
	groundNotes.visualEditor.hidden = !visualEditor.checked;
	groundNotes.noTints.hidden = visualEditor.checked || theme.value === 'default';
	grounds.hidden = visualEditor.checked;
}

function apply() {
	document.documentElement.classList.toggle(
		'skin-theme-clientpref-night', dark.checked
	);

	// The guard in editor-styles.less turns the DOM style sheets off wholesale, so the theme
	// classes can stay as they are; VisualEditor's colour-blind rules are scoped by
	// .cm-mw-colorblind-colors and need it present either way.
	document.body.classList.toggle( 'cm-doc-visualeditor', visualEditor.checked );

	for ( const render of renders ) {
		applyThemeClasses( render, render.querySelector( '.cm-content' ) );
	}
	applyThemeClasses( grounds, grounds );
	applyGroundNotes();

	playground.dispatch( { effects: [
		playgroundTheme.reconfigure( themeExtension() ),
		playgroundSections.reconfigure(
			visualEditor.checked && syntaxHighlightingEnabled() ? sectionDecorations : []
		)
	] } );
	applyExampleSectionClasses();
	applyVisualEditorHighlights();
}

if ( !supportsHighlights ) {
	visualEditor.disabled = true;
	document.getElementById( 'cm-doc-visualeditor-note' ).hidden = false;
}

for ( const input of [ dark, theme, visualEditor ] ) {
	input.addEventListener( 'change', apply );
}

// Open in the mode the reader's system asks for. The checkbox then overrides it.
dark.checked = window.matchMedia( '(prefers-color-scheme: dark)' ).matches;
apply();
