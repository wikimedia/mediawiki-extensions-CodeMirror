'use strict';

/**
 * Turns wikitext into the markup CodeMirror would produce for it.
 *
 * Used at build time so the examples are plain HTML: a real editor per example would mean dozens
 * of instances on one page. The class names come from the mode's own HighlightStyle and from the
 * matching extensions, so they stay correct on their own, but the structure is reproduced here
 * and has to keep matching what the editor builds - a .cm-line per line, highlighted tokens in
 * spans, everything else bare text.
 */

const { EditorState, highlightTree } = require( 'ext.CodeMirror.lib' );
const {
	matchTag
} = require( '../resources/modes/mediawiki/codemirror.mediawiki.matchTag.js' );
const {
	findBracketMatch
} = require( '../resources/codemirror.matchbrackets.util.js' );

/**
 * @param {string} text
 * @return {string}
 */
function escapeHtml( text ) {
	return text.replace(
		/[&<>"]/g,
		( c ) => ( { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ c ] )
	);
}

/**
 * @param {CodeMirrorMediaWiki} mode
 * @param {string} text
 * @param {Array<{from: number, to: number, className: string}>} [marks] Decorations to overlay,
 *   such as the matching-bracket classes the editor adds from the cursor position.
 * @return {string} A .cm-content element holding one .cm-line per line.
 */
function render( mode, text, marks = [] ) {
	// Collect the classes at each character, so overlapping decorations merge the way the
	// editor's nested spans read.
	const classesAt = Array.from( text, () => [] );
	const add = ( from, to, classes ) => {
		for ( let i = from; i < to; i++ ) {
			classesAt[ i ].push( classes );
		}
	};

	highlightTree(
		mode.language.parser.parse( text ),
		mode.highlightStyle,
		( from, to, classes ) => add( from, to, classes )
	);
	for ( const { from, to, className } of marks ) {
		add( from, to, className );
	}

	const lines = [ [] ];
	let previous = null;
	for ( let i = 0; i < text.length; i++ ) {
		if ( text[ i ] === '\n' ) {
			lines.push( [] );
			previous = null;
			continue;
		}
		const classes = classesAt[ i ].join( ' ' );
		const line = lines[ lines.length - 1 ];
		if ( previous === classes ) {
			line[ line.length - 1 ].text += text[ i ];
		} else {
			line.push( { text: text[ i ], classes } );
			previous = classes;
		}
	}

	const html = lines.map( ( line ) => {
		const inner = line.map( ( segment ) => ( segment.classes ?
			`<span class="${ segment.classes }">${ escapeHtml( segment.text ) }</span>` :
			escapeHtml( segment.text )
		) ).join( '' );
		return `<div class="cm-line">${ inner || '<br>' }</div>`;
	} ).join( '' );

	return `<div class="cm-content">${ html }</div>`;
}

/**
 * Runs the editor's matching extensions over an example, so the bracket and tag classes come
 * from the same code that adds them while editing rather than being written out by hand.
 *
 * @param {CodeMirrorMediaWiki} mode
 * @param {string} text
 * @param {string} cursor Text the caret sits immediately after.
 * @return {Array<{from: number, to: number, className: string}>}
 */
function matchMarks( mode, text, cursor ) {
	const pos = text.indexOf( cursor ) + cursor.length;
	const state = EditorState.create( {
		doc: text,
		selection: { anchor: pos },
		extensions: [ mode.language ]
	} );
	const marks = [];

	for ( const match of [
		matchTag( state, pos ),
		findBracketMatch( state, pos, mode.bracketMatchingConfig )
	] ) {
		if ( !match ) {
			continue;
		}
		const className = match.matched ? 'cm-matchingBracket' : 'cm-nonmatchingBracket';
		for ( const range of [ match.start, match.end ] ) {
			if ( range ) {
				marks.push( { from: range.from, to: range.to, className } );
			}
		}
	}

	return marks;
}

module.exports = { escapeHtml, matchMarks, render };
