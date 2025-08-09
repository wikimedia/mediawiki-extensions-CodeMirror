const CodeMirror = require( '../../resources/codemirror.js' );
const mediaWikiLang = require( '../../resources/modes/mediawiki/codemirror.mediawiki.js' );
const bidiIsolationExtension = require( '../../resources/modes/mediawiki/codemirror.mediawiki.bidiIsolation.js' );

const testCases = [
	{
		title: 'wraps HTML tags with span.cm-bidi-isolate',
		input: 'שלום<span class="foobar">שלום</span>שלום',
		output: '<div class="cm-line">שלום<span class="cm-bidi-isolate"><span class="cm-mw-htmltag-bracket">&lt;</span><span class="cm-mw-htmltag-name">span </span><span class="cm-mw-htmltag-attribute">class=</span><span class="cm-mw-htmltag-attribute-value">"foobar"</span><span class="cm-mw-htmltag-bracket">&gt;</span></span>שלום<span class="cm-bidi-isolate"><span class="cm-mw-htmltag-bracket">&lt;/</span><span class="cm-mw-htmltag-name">span</span><span class="cm-mw-htmltag-bracket">&gt;</span></span>שלום</div>'
	},
	{
		title: 'wraps self-closing extension tags with span.cm-bidi-isolate',
		input: '<ref name="foo" />',
		output: '<div class="cm-line"><span class="cm-bidi-isolate"><span class="cm-mw-exttag-bracket cm-mw-ext-ref">&lt;</span><span class="cm-mw-exttag-name cm-mw-ext-ref">ref </span><span class="cm-mw-exttag-attribute cm-mw-ext-ref">name=</span><span class="cm-mw-exttag-attribute-value">"foo"</span><span class="cm-mw-exttag-attribute cm-mw-ext-ref"> </span><span class="cm-mw-exttag-bracket cm-mw-ext-ref">/&gt;</span></span></div>'
	}
];

// Setup CodeMirror instance.
const textarea = document.createElement( 'textarea' );
textarea.dir = 'rtl';
document.body.appendChild( textarea );
const cm = new CodeMirror( textarea, mediaWikiLang() );
cm.initialize();
// Normally ran by mw.hook, but we don't mock the hook system in the Jest tests.
cm.preferences.registerExtension( 'bidiIsolation', bidiIsolationExtension, cm.view );

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
