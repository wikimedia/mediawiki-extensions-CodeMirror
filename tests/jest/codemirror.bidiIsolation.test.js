import CodeMirror from '../../src/codemirror.js';
import mediaWikiLang from '../../src/codemirror.mode.mediawiki.js';

const testCases = [
	{
		title: 'wraps HTML tags with span.cm-bidi-isolate',
		input: 'שלום<span class="foobar">שלום</span>שלום',
		output: '<div class="cm-line">שלום<span class="cm-bidi-isolate"><span class="cm-mw-htmltag-bracket">&lt;</span><span class="cm-mw-htmltag-name">span </span><span class="cm-mw-htmltag-attribute">class="foobar"</span><span class="cm-mw-htmltag-bracket">&gt;</span></span>שלום<span class="cm-bidi-isolate"><span class="cm-mw-htmltag-bracket">&lt;/</span><span class="cm-mw-htmltag-name">span</span><span class="cm-mw-htmltag-bracket">&gt;</span></span>שלום</div>'
	}
];

// Setup CodeMirror instance.
const textarea = document.createElement( 'textarea' );
textarea.dir = 'rtl';
document.body.appendChild( textarea );
const cm = new CodeMirror( textarea );
const mwLang = mediaWikiLang(
	{ bidiIsolation: true },
	{ tags: {} }
);
cm.initialize( [ ...cm.defaultExtensions, mwLang ] );

describe( 'CodeMirrorBidiIsolation', () => {
	it.each( testCases )(
		'bidi isolation ($title)',
		( { input, output } ) => {
			cm.view.dispatch( {
				changes: {
					from: 0,
					to: cm.view.state.doc.length,
					insert: input
				}
			} );
			cm.$textarea.textSelection = jest.fn().mockReturnValue( input );
			expect( cm.view.dom.querySelector( '.cm-content' ).innerHTML ).toStrictEqual( output );
		}
	);
} );
