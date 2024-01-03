import CodeMirror from '../../src/codemirror.js';
import { mediaWikiLang } from '../../src/codemirror.mode.mediawiki.js';
import { mwModeConfig } from '../../src/codemirror.mode.mediawiki.config.js';

/* eslint-disable max-len */
const testCases = [
	{
		title: 'p tags, extra closing tag',
		input: 'this is <p><div>content</p></p>',
		output: '<div class="cm-line">this is <span class="cm-mw-htmltag-bracket">&lt;</span><span class="cm-mw-htmltag-name">p</span><span class="cm-mw-htmltag-bracket">&gt;</span><span class="cm-mw-htmltag-bracket">&lt;</span><span class="cm-mw-htmltag-name">div</span><span class="cm-mw-htmltag-bracket">&gt;</span>content<span class="cm-mw-error">&lt;/p&gt;</span><span class="cm-mw-htmltag-bracket">&lt;/</span><span class="cm-mw-htmltag-name">p</span><span class="cm-mw-htmltag-bracket">&gt;</span></div>'
	},
	{
		title: 'HTML tag attributes',
		input: '<span title="a<b"><b title="a>b"></b></span>',
		output: '<div class="cm-line"><span class="cm-mw-htmltag-bracket">&lt;</span><span class="cm-mw-htmltag-name">span </span><span class="cm-mw-htmltag-attribute">title="a</span><span class="cm-mw-htmltag-attribute">&lt;b"</span><span class="cm-mw-htmltag-bracket">&gt;</span><span class="cm-mw-htmltag-bracket">&lt;</span><span class="cm-mw-htmltag-name">b </span><span class="cm-mw-htmltag-attribute">title="a</span><span class="cm-mw-htmltag-bracket">&gt;</span>b"&gt;<span class="cm-mw-htmltag-bracket">&lt;/</span><span class="cm-mw-htmltag-name">b</span><span class="cm-mw-htmltag-bracket">&gt;</span><span class="cm-mw-htmltag-bracket">&lt;/</span><span class="cm-mw-htmltag-name">span</span><span class="cm-mw-htmltag-bracket">&gt;</span></div>'
	},
	// FIXME: implement tagModes system so other extensions can register tags in CodeMirror
	// {
	//  title: 'ref tag attributes',
	//  input: '<ref name="a<b"/>',
	//  output: extCiteLoaded ?
	//   '<div class="cm-line"><span class="cm-mw-exttag-bracket cm-mw-ext-ref">&lt;</span><span class="cm-mw-exttag-name cm-mw-ext-ref">ref </span><span class="cm-mw-exttag-attribute cm-mw-ext-ref">name="a&lt;b"</span><span class="cm-mw-exttag-bracket cm-mw-ext-ref">/&gt;</span></div>' :
	//   '<div class="cm-line">&lt;ref name="a&lt;b"/&gt;</div>'
	// },
	{
		title: 'indented table with caption and inline headings',
		input: ' ::{| class="wikitable"\n |+ Caption\n |-\n ! Uno !! Dos\n |-\n | Foo || Bar\n |}',
		output: '<div class="cm-line"><span class="cm-mw-indenting"> ::</span><span class="cm-mw-table-bracket">{| </span><span class="cm-mw-table-definition">class</span><span class="cm-mw-table-definition">="wikitable"</span></div><div class="cm-line"><span class="cm-mw-table-delimiter"> |+ </span><span class="cm-mw-table-caption">Caption</span></div><div class="cm-line"><span class="cm-mw-table-delimiter"> |-</span></div><div class="cm-line"><span class="cm-mw-table-delimiter"> ! </span><span class="cm-mw-strong">Uno </span><span class="cm-mw-table-delimiter">!!</span><span class="cm-mw-strong"> Dos</span></div><div class="cm-line"><span class="cm-mw-table-delimiter"> |-</span></div><div class="cm-line"><span class="cm-mw-table-delimiter"> | </span>Foo <span class="cm-mw-table-delimiter">||</span> Bar</div><div class="cm-line"><span class="cm-mw-table-bracket"> |}</span></div>'
	},
	{
		title: 'apostrophe before italic',
		input: 'plain l\'\'\'italic\'\'plain',
		output: '<div class="cm-line">plain l\'<span class="cm-mw-apostrophes-italic">\'\'</span><span class="cm-mw-em">italic</span><span class="cm-mw-apostrophes-italic">\'\'</span>plain</div>'
	},
	{
		title: 'free external links',
		input: 'https://wikimedia.org [ftp://foo.bar FOO] //archive.org',
		output: '<div class="cm-line"><span class="cm-mw-free-extlink-protocol">https://</span><span class="cm-mw-free-extlink">wikimedia.</span><span class="cm-mw-free-extlink">org</span> <span class="cm-mw-link-ground cm-mw-extlink-bracket">[</span><span class="cm-mw-link-ground cm-mw-extlink-protocol">ftp://</span><span class="cm-mw-link-ground cm-mw-extlink">foo.bar</span><span class="cm-mw-link-ground"> </span><span class="cm-mw-link-ground cm-mw-extlink-text">FOO</span><span class="cm-mw-link-ground cm-mw-extlink-bracket">]</span> //archive.org</div>'
	},
	{
		title: 'void tags',
		input: 'a<br>b</br>c a<div>b<br>c</div>d',
		output: '<div class="cm-line">a<span class="cm-mw-htmltag-bracket">&lt;</span><span class="cm-mw-htmltag-name">br</span><span class="cm-mw-htmltag-bracket">&gt;</span>b<span class="cm-mw-error">&lt;/br&gt;</span>c a<span class="cm-mw-htmltag-bracket">&lt;</span><span class="cm-mw-htmltag-name">div</span><span class="cm-mw-htmltag-bracket">&gt;</span>b<span class="cm-mw-htmltag-bracket">&lt;</span><span class="cm-mw-htmltag-name">br</span><span class="cm-mw-htmltag-bracket">&gt;</span>c<span class="cm-mw-htmltag-bracket">&lt;/</span><span class="cm-mw-htmltag-name">div</span><span class="cm-mw-htmltag-bracket">&gt;</span>d</div>'
	},
	{
		title: 'magic words',
		input: '__NOTOC__',
		output: '<div class="cm-line"><span class="cm-mw-double-underscore">__NOTOC__</span></div>'
	},
	// {
	//  title: 'nowiki',
	//  input: '<nowiki>{{foo}}<p> </div> {{{</nowiki>',
	//  output: '<div class="cm-line"><span class="cm-mw-exttag-bracket cm-mw-ext-nowiki">&lt;</span><span class="cm-mw-exttag-name cm-mw-ext-nowiki">nowiki</span><span class="cm-mw-exttag-bracket cm-mw-ext-nowiki">&gt;</span><span class="cm-mw-tag-nowiki cm-mw-tag-nowiki">{{foo}}&lt;p&gt; &lt;/div&gt; {{{</span><span class="cm-mw-exttag-bracket cm-mw-ext-nowiki">&lt;/</span><span class="cm-mw-exttag-name cm-mw-ext-nowiki">nowiki</span><span class="cm-mw-exttag-bracket cm-mw-ext-nowiki">&gt;</span></div>'
	// },
	// {
	//  title: 'ref tag with cite web, extraneous curly braces',
	//  input: '<ref>{{cite web|2=foo}}}}</ref>',
	//  output: extCiteLoaded ?
	//   '<div class="cm-line"><span class="cm-mw-exttag-bracket cm-mw-ext-ref">&lt;</span><span class="cm-mw-exttag-name cm-mw-ext-ref">ref</span><span class="cm-mw-exttag-bracket cm-mw-ext-ref">&gt;</span><span class="cm-mw-tag-ref cm-mw-template-ground cm-mw-template-bracket">{{</span><span class="cm-mw-tag-ref cm-mw-template-ground cm-mw-template-name cm-mw-pagename">cite web</span><span class="cm-mw-tag-ref cm-mw-template-ground cm-mw-template-delimiter">|</span><span class="cm-mw-tag-ref cm-mw-template-ground cm-mw-template-argument-name">2=</span><span class="cm-mw-tag-ref cm-mw-template-ground cm-mw-template">foo</span><span class="cm-mw-tag-ref cm-mw-template-ground cm-mw-template-bracket">}}</span><span class="cm-mw-tag-ref ">}}</span><span class="cm-mw-exttag-bracket cm-mw-ext-ref">&lt;/</span><span class="cm-mw-exttag-name cm-mw-ext-ref">ref</span><span class="cm-mw-exttag-bracket cm-mw-ext-ref">&gt;</span></span></pre>' :
	//   '<div class="cm-line">&lt;ref&gt;<span class="cm-mw-template-ground cm-mw-template-bracket">{{</span><span class="cm-mw-template-ground cm-mw-template-name cm-mw-pagename">cite web</span><span class="cm-mw-template-ground cm-mw-template-delimiter">|</span><span class="cm-mw-template-ground cm-mw-template-argument-name">2=</span><span class="cm-mw-template-ground cm-mw-template">foo</span><span class="cm-mw-template-ground cm-mw-template-bracket">}}</span>}}&lt;/ref&gt;</span></pre>'
	// },
	{
		title: 'template with params and parser function',
		input: '{{foo|1=bar|2={{{param|blah}}}|{{#if:{{{3|}}}|yes|no}}}}',
		output: '<div class="cm-line"><span class="cm-mw-template-ground cm-mw-template-bracket">{{</span><span class="cm-mw-template-ground cm-mw-pagename cm-mw-template-name">foo</span><span class="cm-mw-template-ground cm-mw-template-delimiter">|</span><span class="cm-mw-template-ground cm-mw-template-argument-name">1=</span><span class="cm-mw-template-ground cm-mw-template">bar</span><span class="cm-mw-template-ground cm-mw-template-delimiter">|</span><span class="cm-mw-template-ground cm-mw-template-argument-name">2=</span><span class="cm-mw-template-ground cm-mw-templatevariable-bracket">{{{</span><span class="cm-mw-template-ground cm-mw-templatevariable-name">param</span><span class="cm-mw-template-ground cm-mw-templatevariable-delimiter">|</span><span class="cm-mw-template-ground cm-mw-templatevariable">blah</span><span class="cm-mw-template-ground cm-mw-templatevariable-bracket">}}}</span><span class="cm-mw-template-ground cm-mw-template-delimiter">|</span><span class="cm-mw-template-ext-ground cm-mw-parserfunction-bracket">{{</span><span class="cm-mw-template-ext-ground cm-mw-parserfunction-name">#if</span><span class="cm-mw-template-ext-ground cm-mw-parserfunction-delimiter">:</span><span class="cm-mw-template-ext-ground cm-mw-templatevariable-bracket">{{{</span><span class="cm-mw-template-ext-ground cm-mw-templatevariable-name">3</span><span class="cm-mw-template-ext-ground cm-mw-templatevariable-delimiter">|</span><span class="cm-mw-template-ext-ground cm-mw-templatevariable-bracket">}}}</span><span class="cm-mw-template-ext-ground cm-mw-parserfunction-delimiter">|</span><span class="cm-mw-template-ext-ground cm-mw-parserfunction">yes</span><span class="cm-mw-template-ext-ground cm-mw-parserfunction-delimiter">|</span><span class="cm-mw-template-ext-ground cm-mw-parserfunction">no</span><span class="cm-mw-template-ext-ground cm-mw-parserfunction-bracket">}}</span><span class="cm-mw-template-ground cm-mw-template-bracket">}}</span></div>'
	},
	{
		title: 'T277767: newlines and comments in template names',
		input: '{{#if: | {{some template\n<!-- comment --> }} }}',
		output: '<div class="cm-line"><span class="cm-mw-ext-ground cm-mw-parserfunction-bracket">{{</span><span class="cm-mw-ext-ground cm-mw-parserfunction-name">#if</span><span class="cm-mw-ext-ground cm-mw-parserfunction-delimiter">:</span><span class="cm-mw-ext-ground cm-mw-parserfunction"> </span><span class="cm-mw-ext-ground cm-mw-parserfunction-delimiter">|</span><span class="cm-mw-ext-ground cm-mw-parserfunction"> </span><span class="cm-mw-template-ext-ground cm-mw-template-bracket">{{</span><span class="cm-mw-template-ext-ground cm-mw-pagename cm-mw-template-name">some</span><span class="cm-mw-template-ext-ground cm-mw-pagename cm-mw-template-name"> template</span></div><div class="cm-line"><span class="cm-mw-template-ext-ground cm-mw-comment">&lt;!-- comment --&gt;</span><span class="cm-mw-template-ext-ground cm-mw-template-bracket"> }}</span><span class="cm-mw-ext-ground cm-mw-parserfunction"> </span><span class="cm-mw-ext-ground cm-mw-parserfunction-bracket">}}</span></div>'
	},
	{
		title: 'T108450: template transclusion where the template name is a parameter',
		input: '{{{{{1}}}|…}}',
		output: '<div class="cm-line"><span class="cm-mw-template-ground cm-mw-template-bracket">{{</span><span class="cm-mw-template-ground cm-mw-templatevariable-bracket">{{{</span><span class="cm-mw-template-ground cm-mw-templatevariable-name">1</span><span class="cm-mw-template-ground cm-mw-templatevariable-bracket">}}}</span><span class="cm-mw-template-ground cm-mw-template-delimiter">|</span><span class="cm-mw-template-ground cm-mw-template">…</span><span class="cm-mw-template-ground cm-mw-template-bracket">}}</span></div>'
	},
	{
		title: 'T292967: table syntax where all | are escaped with the {{!}} parser function',
		input: '{{{!}} class="wikitable"\n! header\n{{!}}-\n{{!}} cell\n{{!}}}',
		output: '<div class="cm-line">{<span class="cm-mw-ext-ground cm-mw-parserfunction-bracket">{{</span><span class="cm-mw-ext-ground cm-mw-parserfunction-name">!</span><span class="cm-mw-ext-ground cm-mw-parserfunction-bracket">}}</span> class="wikitable"</div><div class="cm-line">! header</div><div class="cm-line"><span class="cm-mw-ext-ground cm-mw-parserfunction-bracket">{{</span><span class="cm-mw-ext-ground cm-mw-parserfunction-name">!</span><span class="cm-mw-ext-ground cm-mw-parserfunction-bracket">}}</span>-</div><div class="cm-line"><span class="cm-mw-ext-ground cm-mw-parserfunction-bracket">{{</span><span class="cm-mw-ext-ground cm-mw-parserfunction-name">!</span><span class="cm-mw-ext-ground cm-mw-parserfunction-bracket">}}</span> cell</div><div class="cm-line"><span class="cm-mw-ext-ground cm-mw-parserfunction-bracket">{{</span><span class="cm-mw-ext-ground cm-mw-parserfunction-name">!</span><span class="cm-mw-ext-ground cm-mw-parserfunction-bracket">}}</span>}</div>'
	},
	{
		title: 'section headings',
		input: '== My section ==\nFoo bar\n=== Blah ===\nBaz\n= { =\nText',
		output: '<div class="cm-line"><span class="cm-mw-section-header cm-mw-section-2">==</span> My section <span class="cm-mw-section-header">==</span></div><div class="cm-line">Foo bar</div><div class="cm-line"><span class="cm-mw-section-header cm-mw-section-3">===</span> Blah <span class="cm-mw-section-header">===</span></div><div class="cm-line">Baz</div><div class="cm-line"><span class="cm-mw-section-header cm-mw-section-1">=</span> { <span class="cm-mw-section-header">=</span></div><div class="cm-line">Text</div>'
	},
	{
		title: 'section headings with trailing comments',
		input: '== My section == <!-- comment --> \nFoo bar\n=== Blah ===<!--comment-->\nBaz\n== <i>a</i> <!-- comment --> == <!--comment-->',
		output: '<div class="cm-line"><span class="cm-mw-section-header cm-mw-section-2">==</span> My section <span class="cm-mw-section-header">== </span><span class="cm-mw-comment">&lt;!-- comment --&gt;</span> </div><div class="cm-line">Foo bar</div><div class="cm-line"><span class="cm-mw-section-header cm-mw-section-3">===</span> Blah <span class="cm-mw-section-header">===</span><span class="cm-mw-comment">&lt;!--comment--&gt;</span></div><div class="cm-line">Baz</div><div class="cm-line"><span class="cm-mw-section-header cm-mw-section-2">==</span> <span class="cm-mw-htmltag-bracket">&lt;</span><span class="cm-mw-htmltag-name">i</span><span class="cm-mw-htmltag-bracket">&gt;</span>a<span class="cm-mw-htmltag-bracket">&lt;/</span><span class="cm-mw-htmltag-name">i</span><span class="cm-mw-htmltag-bracket">&gt;</span> <span class="cm-mw-comment">&lt;!-- comment --&gt;</span> <span class="cm-mw-section-header">== </span><span class="cm-mw-comment">&lt;!--comment--&gt;</span></div>'
	},
	{
		title: 'bullets and numbering, with invalid leading spacing',
		input: '* bullet A\n* bullet B\n# one\n # two',
		output: '<div class="cm-line"><span class="cm-mw-list">*</span> bullet A</div><div class="cm-line"><span class="cm-mw-list">*</span> bullet B</div><div class="cm-line"><span class="cm-mw-list">#</span> one</div><div class="cm-line"><span class="cm-mw-skipformatting"> </span># two</div>'
	},
	{
		title: 'link with bold text',
		input: '[[Link title|\'\'\'bold link\'\'\']]',
		output: '<div class="cm-line"><span class="cm-mw-link-ground cm-mw-link-bracket">[[</span><span class="cm-mw-link-ground cm-mw-link-pagename cm-mw-pagename">Link</span><span class="cm-mw-link-ground cm-mw-link-pagename cm-mw-pagename"> title</span><span class="cm-mw-link-ground cm-mw-link-delimiter">|</span><span class="cm-mw-link-ground cm-mw-link-text cm-mw-apostrophes">\'\'\'</span><span class="cm-mw-link-ground cm-mw-link-text cm-mw-strong">bold link</span><span class="cm-mw-link-ground cm-mw-link-text cm-mw-apostrophes">\'\'\'</span><span class="cm-mw-link-ground cm-mw-link-bracket">]]</span></div>'
	},
	{
		title: 'horizontal rule',
		input: 'One\n----\nTwo',
		output: '<div class="cm-line">One</div><div class="cm-line"><span class="cm-mw-hr">----</span></div><div class="cm-line">Two</div>'
	},
	{
		title: 'comments',
		input: '<!-- foo [[bar]] {{{param}}} -->',
		output: '<div class="cm-line"><span class="cm-mw-comment">&lt;!-- foo [[bar]] {{{param}}} --&gt;</span></div>'
	},
	{
		title: 'signatures',
		input: 'my sig ~~~ ~~~~ ~~~~~~~',
		output: '<div class="cm-line">my sig <span class="cm-mw-signature">~~~</span> <span class="cm-mw-signature">~~~~</span> <span class="cm-mw-signature">~~~~~</span>~~</div>'
	},
	// {
	//  title: 'new',
	//  input: '<ref></Ref>',
	//  output: extCiteLoaded ?
	//   '<div class="cm-line"><span class="cm-mw-exttag-bracket cm-mw-ext-ref">&lt;</span><span class="cm-mw-exttag-name cm-mw-ext-ref">ref</span><span class="cm-mw-exttag-bracket cm-mw-ext-ref">&gt;&lt;/</span><span class="cm-mw-exttag-name cm-mw-ext-Ref">Ref</span><span class="cm-mw-exttag-bracket cm-mw-ext-Ref">&gt;</span></div>' :
	//   '<div class="cm-line">&lt;ref&gt;&lt;/Ref&gt;</div>'
	// },
	{
		title: 'multi-line tag',
		input: '<div\nid="foo"\n>bar</div>',
		output: '<div class="cm-line"><span class="cm-mw-htmltag-bracket">&lt;</span><span class="cm-mw-htmltag-name">div</span></div><div class="cm-line"><span class="cm-mw-htmltag-attribute">id="foo"</span></div><div class="cm-line"><span class="cm-mw-htmltag-bracket">&gt;</span>bar<span class="cm-mw-htmltag-bracket">&lt;/</span><span class="cm-mw-htmltag-name">div</span><span class="cm-mw-htmltag-bracket">&gt;</span></div>'
	},
	{
		title: 'HTML entities',
		input: '&#x2014;\n[[&#47;dev/null]]',
		output: '<div class="cm-line"><span class="cm-mw-html-entity">&amp;#x2014;</span></div><div class="cm-line"><span class="cm-mw-link-ground cm-mw-link-bracket">[[</span><span class="cm-mw-link-ground cm-mw-html-entity">&amp;#47;</span><span class="cm-mw-link-ground cm-mw-link-pagename cm-mw-pagename">dev/null</span><span class="cm-mw-link-ground cm-mw-link-bracket">]]</span></div>'
	}
];

// Setup CodeMirror instance.
const textarea = document.createElement( 'textarea' );
document.body.appendChild( textarea );
const cm = new CodeMirror( textarea );
// Stub the config normally provided by mw.config.get('extCodeMirrorConfig')
const mwLang = mediaWikiLang( {
	urlProtocols: 'ftp://|https://',
	doubleUnderscore: [ {
		__notoc__: 'notoc'
	} ],
	functionSynonyms: [ {}, {
		'!': '!'
	} ]
} );
cm.initialize( [ ...cm.defaultExtensions, mwLang ] );

describe( 'CodeMirrorModeMediaWiki', () => {
	it.each( testCases )(
		'syntax highlighting ($title)',
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

	it( 'configuration contains all expected tokens', () => {
		expect( Object.keys( mwModeConfig.tags ) ).toStrictEqual( [
			'apostrophes',
			'apostrophesBold',
			'apostrophesItalic',
			'comment',
			'doubleUnderscore',
			'extLink',
			'extLinkBracket',
			'extLinkProtocol',
			'extLinkText',
			'hr',
			'htmlTagAttribute',
			'htmlTagBracket',
			'htmlTagName',
			'indenting',
			'linkBracket',
			'linkDelimiter',
			'linkText',
			'linkToSection',
			'list',
			'parserFunction',
			'parserFunctionBracket',
			'parserFunctionDelimiter',
			'parserFunctionName',
			'sectionHeader',
			'sectionHeader1',
			'sectionHeader2',
			'sectionHeader3',
			'sectionHeader4',
			'sectionHeader5',
			'sectionHeader6',
			'signature',
			'tableBracket',
			'tableDefinition',
			'tableDelimiter',
			'template',
			'templateArgumentName',
			'templateBracket',
			'templateDelimiter',
			'templateName',
			'templateVariable',
			'templateVariableBracket',
			'templateVariableName',
			// Custom tags
			'em',
			'error',
			'extGround',
			'freeExtLink',
			'freeExtLinkProtocol',
			'htmlEntity',
			'link',
			'linkGround',
			'linkPageName',
			'pageName',
			'skipFormatting',
			'strong',
			'tableCaption',
			'templateGround',
			'templateExtGround',
			'templateLinkGround',
			'templateVariableDelimiter',
			'template2ExtGround',
			'template2Ground',
			'template3ExtGround',
			'template3Ground'
		] );
	} );
} );
