const { StreamParser } = require( '@codemirror/language' );
const { Tag } = require( '@lezer/highlight' );
const CodeMirror = require( '../../resources/codemirror.js' );
const mediaWikiLang = require( '../../resources/codemirror.mediawiki.js' );
const mwModeConfig = require( '../../resources/codemirror.mediawiki.config.js' );

// NOTE: each test case should have a space before the closing </div>
// This is to avoid interactive UI components from showing up in the test output.
const testCases = [
	{
		title: 'p tags, extra closing tag',
		input: 'this is <p><div>content</p></p>',
		output: '<div class="cm-line">this is <span class="cm-mw-htmltag-bracket">&lt;</span><span class="cm-mw-htmltag-name">p</span><span class="cm-mw-htmltag-bracket">&gt;</span><span class="cm-mw-htmltag-bracket">&lt;</span><span class="cm-mw-htmltag-name">div</span><span class="cm-mw-htmltag-bracket">&gt;</span>content<span class="cm-mw-error">&lt;/p&gt;</span><span class="cm-mw-htmltag-bracket">&lt;/</span><span class="cm-mw-htmltag-name">p</span><span class="cm-mw-htmltag-bracket">&gt;</span> </div>'
	},
	{
		title: 'HTML tag attributes',
		input: '<span title="a<b"><b title="a>b"></b></span>',
		output: '<div class="cm-line"><span class="cm-mw-htmltag-bracket">&lt;</span><span class="cm-mw-htmltag-name">span </span><span class="cm-mw-htmltag-attribute">title="a</span><span class="cm-mw-htmltag-attribute">&lt;b"</span><span class="cm-mw-htmltag-bracket">&gt;</span><span class="cm-mw-htmltag-bracket">&lt;</span><span class="cm-mw-htmltag-name">b </span><span class="cm-mw-htmltag-attribute">title="a</span><span class="cm-mw-htmltag-bracket">&gt;</span>b"&gt;<span class="cm-mw-htmltag-bracket">&lt;/</span><span class="cm-mw-htmltag-name">b</span><span class="cm-mw-htmltag-bracket">&gt;</span><span class="cm-mw-htmltag-bracket">&lt;/</span><span class="cm-mw-htmltag-name">span</span><span class="cm-mw-htmltag-bracket">&gt;</span> </div>'
	},
	{
		title: 'ref tag attributes',
		input: '<ref name="a<b"/>',
		output: '<div class="cm-line"><span class="cm-mw-exttag-bracket cm-mw-ext-ref">&lt;</span><span class="cm-mw-exttag-name cm-mw-ext-ref">ref </span><span class="cm-mw-exttag-attribute cm-mw-ext-ref">name="a&lt;b"</span><span class="cm-mw-exttag-bracket cm-mw-ext-ref">/&gt;</span> </div>'
	},
	{
		title: 'indented table with caption and inline headings',
		input: ':{|\n|}\n: {|\n|}\n :: {| class="wikitable"\n |+ Caption\n |-\n ! Uno !! Dos\n |-\n | Foo || Bar\n |}',
		output: '<div class="cm-line"><span class="cm-mw-indenting">:</span><span class="cm-mw-table-bracket">{|</span></div><div class="cm-line"><span class="cm-mw-table-bracket">|}</span></div><div class="cm-line"><span class="cm-mw-indenting">: </span><span class="cm-mw-table-bracket">{|</span></div><div class="cm-line"><span class="cm-mw-table-bracket">|}</span></div><div class="cm-line"><span class="cm-mw-indenting"> :: </span><span class="cm-mw-table-bracket">{| </span><span class="cm-mw-table-definition">class</span><span class="cm-mw-table-definition">="wikitable"</span></div><div class="cm-line"><span class="cm-mw-table-delimiter"> |+ </span><span class="cm-mw-table-caption">Caption</span></div><div class="cm-line"><span class="cm-mw-table-delimiter"> |-</span></div><div class="cm-line"><span class="cm-mw-table-delimiter"> ! </span><span class="cm-mw-strong">Uno </span><span class="cm-mw-table-delimiter">!!</span><span class="cm-mw-strong"> Dos</span></div><div class="cm-line"><span class="cm-mw-table-delimiter"> |-</span></div><div class="cm-line"><span class="cm-mw-table-delimiter"> | </span>Foo <span class="cm-mw-table-delimiter">||</span> Bar</div><div class="cm-line"><span class="cm-mw-table-bracket"> |}</span> </div>'
	},
	{
		title: 'apostrophe before italic',
		input: 'plain l\'\'\'italic\'\'plain',
		output: '<div class="cm-line">plain l\'<span class="cm-mw-apostrophes-italic">\'\'</span><span class="cm-mw-em">italic</span><span class="cm-mw-apostrophes-italic">\'\'</span>plain </div>'
	},
	{
		title: 'free external links',
		input: '//archive.org [ftp://foo.bar FOO] https://wikimedia.org/~\nx',
		output: '<div class="cm-line">//archive.org <span class="cm-mw-link-ground cm-mw-extlink-bracket">[</span><span class="cm-mw-link-ground cm-mw-extlink-protocol">ftp://</span><span class="cm-mw-link-ground cm-mw-extlink">foo.bar</span><span class="cm-mw-link-ground"> </span><span class="cm-mw-link-ground cm-mw-extlink-text">FOO</span><span class="cm-mw-link-ground cm-mw-extlink-bracket">]</span> <span class="cm-mw-free-extlink-protocol">https://</span><span class="cm-mw-free-extlink">wikimedia.</span><span class="cm-mw-free-extlink">org/~</span></div><div class="cm-line">x </div>'
	},
	{
		title: 'not free external links',
		input: 'news: foo news:bar [news: baz]',
		output: '<div class="cm-line">news: foo <span class="cm-mw-free-extlink-protocol">news:</span><span class="cm-mw-free-extlink">bar</span> [news: baz] </div>'
	},
	{
		title: 'void tags',
		input: 'a<br>b</br>c a<div>b<br>c</div>d',
		output: '<div class="cm-line">a<span class="cm-mw-htmltag-bracket">&lt;</span><span class="cm-mw-htmltag-name">br</span><span class="cm-mw-htmltag-bracket">&gt;</span>b<span class="cm-mw-error">&lt;/br&gt;</span>c a<span class="cm-mw-htmltag-bracket">&lt;</span><span class="cm-mw-htmltag-name">div</span><span class="cm-mw-htmltag-bracket">&gt;</span>b<span class="cm-mw-htmltag-bracket">&lt;</span><span class="cm-mw-htmltag-name">br</span><span class="cm-mw-htmltag-bracket">&gt;</span>c<span class="cm-mw-htmltag-bracket">&lt;/</span><span class="cm-mw-htmltag-name">div</span><span class="cm-mw-htmltag-bracket">&gt;</span>d </div>'
	},
	{
		title: 'magic words',
		input: '__NOTOC__',
		output: '<div class="cm-line"><span class="cm-mw-double-underscore">__NOTOC__</span> </div>'
	},
	{
		title: 'nowiki',
		input: '<nowiki>{{foo}}<p> </div> {{{</nowiki>\n<nowiki/><pre class="foo">\n\n {{bar}}</pre>',
		output: '<div class="cm-line"><span class="cm-mw-exttag-bracket cm-mw-ext-nowiki">&lt;</span><span class="cm-mw-exttag-name cm-mw-ext-nowiki">nowiki</span><span class="cm-mw-exttag-bracket cm-mw-ext-nowiki">&gt;</span><span class="cm-mw-tag-nowiki">{{foo}}&lt;p&gt; &lt;/div&gt; {{{</span><span class="cm-mw-exttag-bracket cm-mw-ext-nowiki">&lt;/</span><span class="cm-mw-exttag-name cm-mw-ext-nowiki">nowiki</span><span class="cm-mw-exttag-bracket cm-mw-ext-nowiki">&gt;</span></div><div class="cm-line"><span class="cm-mw-exttag-bracket cm-mw-ext-nowiki">&lt;</span><span class="cm-mw-exttag-name cm-mw-ext-nowiki">nowiki</span><span class="cm-mw-exttag-bracket cm-mw-ext-nowiki">/&gt;</span><span class="cm-mw-exttag-bracket cm-mw-ext-pre">&lt;</span><span class="cm-mw-exttag-name cm-mw-ext-pre">pre </span><span class="cm-mw-exttag-attribute cm-mw-ext-pre">class="foo"</span><span class="cm-mw-exttag-bracket cm-mw-ext-pre">&gt;</span></div><div class="cm-line"><br></div><div class="cm-line"><span class="cm-mw-tag-pre"> {{bar}}</span><span class="cm-mw-exttag-bracket cm-mw-ext-pre">&lt;/</span><span class="cm-mw-exttag-name cm-mw-ext-pre">pre</span><span class="cm-mw-exttag-bracket cm-mw-ext-pre">&gt;</span> </div>'
	},
	{
		title: 'ref tag with cite web, extraneous curly braces',
		input: '<ref>{{cite web|2=foo}}}}</ref>',
		output: '<div class="cm-line"><span class="cm-mw-exttag-bracket cm-mw-ext-ref">&lt;</span><span class="cm-mw-exttag-name cm-mw-ext-ref">ref</span><span class="cm-mw-exttag-bracket cm-mw-ext-ref">&gt;</span><span class="cm-mw-tag-ref cm-mw-template-ground cm-mw-template-bracket">{{</span><span class="cm-mw-tag-ref cm-mw-template-ground cm-mw-pagename cm-mw-template-name">cite</span><span class="cm-mw-tag-ref cm-mw-template-ground cm-mw-pagename cm-mw-template-name"> web</span><span class="cm-mw-tag-ref cm-mw-template-ground cm-mw-template-delimiter">|</span><span class="cm-mw-tag-ref cm-mw-template-ground cm-mw-template-argument-name">2=</span><span class="cm-mw-tag-ref cm-mw-template-ground cm-mw-template">foo</span><span class="cm-mw-tag-ref cm-mw-template-ground cm-mw-template-bracket">}}</span><span class="cm-mw-tag-ref">}</span><span class="cm-mw-tag-ref">}</span><span class="cm-mw-exttag-bracket cm-mw-ext-ref">&lt;/</span><span class="cm-mw-exttag-name cm-mw-ext-ref">ref</span><span class="cm-mw-exttag-bracket cm-mw-ext-ref">&gt;</span> </div>'
	},
	{
		title: 'template with params and parser function',
		input: '{{foo|1=bar|2={{{param|blah}}}|{{#if:{{{3|}}}|yes|no}}}}',
		output: '<div class="cm-line"><span class="cm-mw-template-ground cm-mw-template-bracket">{{</span><span class="cm-mw-template-ground cm-mw-pagename cm-mw-template-name">foo</span><span class="cm-mw-template-ground cm-mw-template-delimiter">|</span><span class="cm-mw-template-ground cm-mw-template-argument-name">1=</span><span class="cm-mw-template-ground cm-mw-template">bar</span><span class="cm-mw-template-ground cm-mw-template-delimiter">|</span><span class="cm-mw-template-ground cm-mw-template-argument-name">2=</span><span class="cm-mw-template-ground cm-mw-templatevariable-bracket">{{{</span><span class="cm-mw-template-ground cm-mw-templatevariable-name">param</span><span class="cm-mw-template-ground cm-mw-templatevariable-delimiter">|</span><span class="cm-mw-template-ground cm-mw-templatevariable">blah</span><span class="cm-mw-template-ground cm-mw-templatevariable-bracket">}}}</span><span class="cm-mw-template-ground cm-mw-template-delimiter">|</span><span class="cm-mw-template-ext-ground cm-mw-parserfunction-bracket">{{</span><span class="cm-mw-template-ext-ground cm-mw-parserfunction-name">#if</span><span class="cm-mw-template-ext-ground cm-mw-parserfunction-delimiter">:</span><span class="cm-mw-template-ext-ground cm-mw-templatevariable-bracket">{{{</span><span class="cm-mw-template-ext-ground cm-mw-templatevariable-name">3</span><span class="cm-mw-template-ext-ground cm-mw-templatevariable-delimiter">|</span><span class="cm-mw-template-ext-ground cm-mw-templatevariable-bracket">}}}</span><span class="cm-mw-template-ext-ground cm-mw-parserfunction-delimiter">|</span><span class="cm-mw-template-ext-ground cm-mw-parserfunction">yes</span><span class="cm-mw-template-ext-ground cm-mw-parserfunction-delimiter">|</span><span class="cm-mw-template-ext-ground cm-mw-parserfunction">no</span><span class="cm-mw-template-ext-ground cm-mw-parserfunction-bracket">}}</span><span class="cm-mw-template-ground cm-mw-template-bracket">}}</span> </div>'
	},
	{
		title: 'T277767: newlines and comments in template names',
		input: '{{#if: | {{some template\n<!-- comment --> }} }}',
		output: '<div class="cm-line"><span class="cm-mw-ext-ground cm-mw-parserfunction-bracket">{{</span><span class="cm-mw-ext-ground cm-mw-parserfunction-name">#if</span><span class="cm-mw-ext-ground cm-mw-parserfunction-delimiter">:</span><span class="cm-mw-ext-ground cm-mw-parserfunction"> </span><span class="cm-mw-ext-ground cm-mw-parserfunction-delimiter">|</span><span class="cm-mw-ext-ground cm-mw-parserfunction"> </span><span class="cm-mw-template-ext-ground cm-mw-template-bracket">{{</span><span class="cm-mw-template-ext-ground cm-mw-pagename cm-mw-template-name">some</span><span class="cm-mw-template-ext-ground cm-mw-pagename cm-mw-template-name"> template</span></div><div class="cm-line"><span class="cm-mw-template-ext-ground cm-mw-comment">&lt;!-- comment --&gt;</span><span class="cm-mw-template-ext-ground cm-mw-template-bracket"> }}</span><span class="cm-mw-ext-ground cm-mw-parserfunction"> </span><span class="cm-mw-ext-ground cm-mw-parserfunction-bracket">}}</span> </div>'
	},
	{
		title: 'T108450: template transclusion where the template name is a parameter',
		input: '{{{{{1}}}|…}}',
		output: '<div class="cm-line"><span class="cm-mw-template-ground cm-mw-template-bracket">{{</span><span class="cm-mw-template-ground cm-mw-templatevariable-bracket">{{{</span><span class="cm-mw-template-ground cm-mw-templatevariable-name">1</span><span class="cm-mw-template-ground cm-mw-templatevariable-bracket">}}}</span><span class="cm-mw-template-ground cm-mw-template-delimiter">|</span><span class="cm-mw-template-ground cm-mw-template">…</span><span class="cm-mw-template-ground cm-mw-template-bracket">}}</span> </div>'
	},
	{
		title: 'T292967: table syntax where all | are escaped with the {{!}} parser function',
		input: '{{{!}} class="wikitable"\n! header\n{{!}}-\n{{!}} cell\n{{!}}}',
		output: '<div class="cm-line">{<span class="cm-mw-ext-ground cm-mw-parserfunction-bracket">{{</span><span class="cm-mw-ext-ground cm-mw-parserfunction-name">!</span><span class="cm-mw-ext-ground cm-mw-parserfunction-bracket">}}</span> class="wikitable"</div><div class="cm-line">! header</div><div class="cm-line"><span class="cm-mw-ext-ground cm-mw-parserfunction-bracket">{{</span><span class="cm-mw-ext-ground cm-mw-parserfunction-name">!</span><span class="cm-mw-ext-ground cm-mw-parserfunction-bracket">}}</span>-</div><div class="cm-line"><span class="cm-mw-ext-ground cm-mw-parserfunction-bracket">{{</span><span class="cm-mw-ext-ground cm-mw-parserfunction-name">!</span><span class="cm-mw-ext-ground cm-mw-parserfunction-bracket">}}</span> cell</div><div class="cm-line"><span class="cm-mw-ext-ground cm-mw-parserfunction-bracket">{{</span><span class="cm-mw-ext-ground cm-mw-parserfunction-name">!</span><span class="cm-mw-ext-ground cm-mw-parserfunction-bracket">}}</span>} </div>'
	},
	{
		title: 'T324374: table cell attributes',
		input: '{|\n|+ class="z" | Z\n! class="a" | A !! class="b" | B\n|-\n! class="c" | C || class="d" | D\n|-\n| class="e" | E || class="f" | F\n|}',
		output: '<div class="cm-line"><span class="cm-mw-table-bracket">{|</span></div><div class="cm-line"><span class="cm-mw-table-delimiter">|+ </span><span class="cm-mw-table-caption">class="z" </span><span class="cm-mw-table-delimiter">|</span><span class="cm-mw-table-caption"> Z</span></div><div class="cm-line"><span class="cm-mw-table-delimiter">! </span><span class="cm-mw-strong">class="a" </span><span class="cm-mw-table-delimiter">|</span><span class="cm-mw-strong"> A </span><span class="cm-mw-table-delimiter">!!</span><span class="cm-mw-strong"> class="b" </span><span class="cm-mw-table-delimiter">|</span><span class="cm-mw-strong"> B</span></div><div class="cm-line"><span class="cm-mw-table-delimiter">|-</span></div><div class="cm-line"><span class="cm-mw-table-delimiter">! </span><span class="cm-mw-strong">class="c" </span><span class="cm-mw-table-delimiter">|</span><span class="cm-mw-strong"> C </span><span class="cm-mw-table-delimiter">||</span><span class="cm-mw-strong"> class="d" </span><span class="cm-mw-table-delimiter">|</span><span class="cm-mw-strong"> D</span></div><div class="cm-line"><span class="cm-mw-table-delimiter">|-</span></div><div class="cm-line"><span class="cm-mw-table-delimiter">| </span>class="e" <span class="cm-mw-table-delimiter">|</span> E <span class="cm-mw-table-delimiter">||</span> class="f" <span class="cm-mw-table-delimiter">|</span> F</div><div class="cm-line"><span class="cm-mw-table-bracket">|}</span> </div>'
	},
	{
		title: 'section headings',
		input: '== My section ==\nFoo bar\n=== Blah ===\nBaz\n= { =\nText',
		output: '<div class="cm-line"><span class="cm-mw-section-header cm-mw-section-2">==</span><span class="cm-mw-section"> My section </span><span class="cm-mw-section-header">==</span></div><div class="cm-line">Foo bar</div><div class="cm-line"><span class="cm-mw-section-header cm-mw-section-3">===</span><span class="cm-mw-section"> Blah </span><span class="cm-mw-section-header">===</span></div><div class="cm-line">Baz</div><div class="cm-line"><span class="cm-mw-section-header cm-mw-section-1">=</span><span class="cm-mw-section"> </span><span class="cm-mw-section">{</span><span class="cm-mw-section"> </span><span class="cm-mw-section-header">=</span></div><div class="cm-line">Text </div>'
	},
	{
		title: 'section headings with trailing comments',
		input: '== My section == <!-- comment --> \nFoo bar\n=== Blah ===<!--comment-->\nBaz\n== <i>a</i> <!-- comment --> == <!--comment-->',
		output: '<div class="cm-line"><span class="cm-mw-section-header cm-mw-section-2">==</span><span class="cm-mw-section"> My section </span><span class="cm-mw-section-header">== </span><span class="cm-mw-comment">&lt;!-- comment --&gt;</span> </div><div class="cm-line">Foo bar</div><div class="cm-line"><span class="cm-mw-section-header cm-mw-section-3">===</span><span class="cm-mw-section"> Blah </span><span class="cm-mw-section-header">===</span><span class="cm-mw-comment">&lt;!--comment--&gt;</span></div><div class="cm-line">Baz</div><div class="cm-line"><span class="cm-mw-section-header cm-mw-section-2">==</span><span class="cm-mw-section"> </span><span class="cm-mw-htmltag-bracket">&lt;</span><span class="cm-mw-htmltag-name">i</span><span class="cm-mw-htmltag-bracket">&gt;</span><span class="cm-mw-section">a</span><span class="cm-mw-htmltag-bracket">&lt;/</span><span class="cm-mw-htmltag-name">i</span><span class="cm-mw-htmltag-bracket">&gt;</span><span class="cm-mw-section"> </span><span class="cm-mw-comment">&lt;!-- comment --&gt;</span><span class="cm-mw-section"> </span><span class="cm-mw-section-header">== </span><span class="cm-mw-comment">&lt;!--comment--&gt;</span> </div>'
	},
	{
		title: 'bullets and numbering, with invalid leading spacing',
		input: '* bullet A\n* bullet B\n# one\n # two',
		output: '<div class="cm-line"><span class="cm-mw-list">*</span> bullet A</div><div class="cm-line"><span class="cm-mw-list">*</span> bullet B</div><div class="cm-line"><span class="cm-mw-list">#</span> one</div><div class="cm-line"><span class="cm-mw-skipformatting"> </span># two </div>'
	},
	{
		title: 'nested ordered, unordered and definition lists',
		input: '*#;: item A\n#;:* item B\n;:*# item C\n:*#; item D',
		output: '<div class="cm-line"><span class="cm-mw-list">*#;:</span><span class="cm-mw-strong"> item</span><span class="cm-mw-strong"> A</span></div><div class="cm-line"><span class="cm-mw-list">#;:*</span><span class="cm-mw-strong"> item</span><span class="cm-mw-strong"> B</span></div><div class="cm-line"><span class="cm-mw-list">;:*#</span><span class="cm-mw-strong"> item</span><span class="cm-mw-strong"> C</span></div><div class="cm-line"><span class="cm-mw-list">:*#;</span><span class="cm-mw-strong"> item</span><span class="cm-mw-strong"> D</span><span class="cm-mw-strong"> </span></div>'
	},
	{
		title: 'one-line definition list',
		input: ';term:definition\n;term\n:definition',
		output: '<div class="cm-line"><span class="cm-mw-list">;</span><span class="cm-mw-strong">term</span><span class="cm-mw-indenting">:</span>definition</div><div class="cm-line"><span class="cm-mw-list">;</span><span class="cm-mw-strong">term</span></div><div class="cm-line"><span class="cm-mw-list">:</span>definition </div>'
	},
	{
		title: 'link with bold text',
		input: '[[Link title|\'\'\'bold link\'\'\']]',
		output: '<div class="cm-line"><span class="cm-mw-link-ground cm-mw-link-bracket">[[</span><span class="cm-mw-link-ground cm-mw-link-pagename cm-mw-pagename">Link</span><span class="cm-mw-link-ground cm-mw-link-pagename cm-mw-pagename"> title</span><span class="cm-mw-link-ground cm-mw-link-delimiter">|</span><span class="cm-mw-link-ground cm-mw-link-text cm-mw-apostrophes">\'\'\'</span><span class="cm-mw-link-ground cm-mw-link-text cm-mw-strong">bold link</span><span class="cm-mw-link-ground cm-mw-link-text cm-mw-apostrophes">\'\'\'</span><span class="cm-mw-link-ground cm-mw-link-bracket">]]</span> </div>'
	},
	{
		title: 'horizontal rule',
		input: 'One\n----\nTwo',
		output: '<div class="cm-line">One</div><div class="cm-line"><span class="cm-mw-hr">----</span></div><div class="cm-line">Two </div>'
	},
	{
		title: 'comments',
		input: '<!-- foo [[bar]] {{{param}}} -->',
		output: '<div class="cm-line"><span class="cm-mw-comment">&lt;!-- foo [[bar]] {{{param}}} --&gt;</span> </div>'
	},
	{
		title: 'signatures',
		input: 'my sig ~~~ ~~~~ ~~~~~~~',
		output: '<div class="cm-line">my sig <span class="cm-mw-signature">~~~</span> <span class="cm-mw-signature">~~~~</span> <span class="cm-mw-signature">~~~~~</span>~~ </div>'
	},
	{
		title: 'capitalization of tags',
		input: '<ref></Ref>',
		output: '<div class="cm-line"><span class="cm-mw-exttag-bracket cm-mw-ext-ref">&lt;</span><span class="cm-mw-exttag-name cm-mw-ext-ref">ref</span><span class="cm-mw-exttag-bracket cm-mw-ext-ref">&gt;</span><span class="cm-mw-exttag-bracket cm-mw-ext-ref">&lt;/</span><span class="cm-mw-exttag-name cm-mw-ext-ref">Ref</span><span class="cm-mw-exttag-bracket cm-mw-ext-ref">&gt;</span> </div>'
	},
	{
		title: 'multi-line tag',
		input: '<div\nid="foo"\n>bar</div>',
		output: '<div class="cm-line"><span class="cm-mw-htmltag-bracket">&lt;</span><span class="cm-mw-htmltag-name">div</span></div><div class="cm-line"><span class="cm-mw-htmltag-attribute">id="foo"</span></div><div class="cm-line"><span class="cm-mw-htmltag-bracket">&gt;</span>bar<span class="cm-mw-htmltag-bracket">&lt;/</span><span class="cm-mw-htmltag-name">div</span><span class="cm-mw-htmltag-bracket">&gt;</span> </div>'
	},
	{
		title: 'HTML entities',
		input: '&#x2014;\n[[&#47;dev/null]]',
		output: '<div class="cm-line"><span class="cm-mw-html-entity">&amp;#x2014;</span></div><div class="cm-line"><span class="cm-mw-link-ground cm-mw-link-bracket">[[</span><span class="cm-mw-link-ground cm-mw-html-entity">&amp;#47;</span><span class="cm-mw-link-ground cm-mw-link-pagename cm-mw-pagename">dev/null</span><span class="cm-mw-link-ground cm-mw-link-bracket">]]</span> </div>'
	},
	{
		title: 'Extension tag with no TagMode',
		input: '<myextension>foo\nbar\nbaz</myextension>',
		output: '<div class="cm-line"><span class="cm-mw-exttag-bracket cm-mw-ext-myextension">&lt;</span><span class="cm-mw-exttag-name cm-mw-ext-myextension">myextension</span><span class="cm-mw-exttag-bracket cm-mw-ext-myextension">&gt;</span><span class="cm-mw-exttag">foo</span></div><div class="cm-line"><span class="cm-mw-exttag">bar</span></div><div class="cm-line"><span class="cm-mw-exttag">baz</span><span class="cm-mw-exttag-bracket cm-mw-ext-myextension">&lt;/</span><span class="cm-mw-exttag-name cm-mw-ext-myextension">myextension</span><span class="cm-mw-exttag-bracket cm-mw-ext-myextension">&gt;</span> </div>'
	},
	{
		title: 'Special characters',
		input: 'Soft­hyphen\nzero-width​space\nnon-breaking space\nnarrow nbsp',
		// i18n messages are the keys because we don't stub mw.msg() in this test.
		output: '<div class="cm-line">Soft<img class="cm-widgetBuffer" aria-hidden="true"><span class="cm-specialChar" title="codemirror-control-character" aria-label="codemirror-control-character">•</span><img class="cm-widgetBuffer" aria-hidden="true">hyphen</div><div class="cm-line">zero-width<img class="cm-widgetBuffer" aria-hidden="true"><span class="cm-specialChar" title="codemirror-special-char-zero-width-space" aria-label="codemirror-special-char-zero-width-space">•</span><img class="cm-widgetBuffer" aria-hidden="true">space</div><div class="cm-line">non-breaking<img class="cm-widgetBuffer" aria-hidden="true"><span class="cm-special-char-nbsp" title="codemirror-special-char-nbsp" aria-label="codemirror-special-char-nbsp">·</span><img class="cm-widgetBuffer" aria-hidden="true">space</div><div class="cm-line">narrow<img class="cm-widgetBuffer" aria-hidden="true"><span class="cm-special-char-nbsp" title="codemirror-special-char-narrow-nbsp" aria-label="codemirror-special-char-narrow-nbsp">·</span><img class="cm-widgetBuffer" aria-hidden="true">nbsp </div>'
	},
	{
		title: 'Nested template calls',
		input: '{{foo|{{bar|[[Test]]|{{baz|[[Test2]]}}}}}}',
		output: '<div class="cm-line"><span class="cm-mw-template-ground cm-mw-template-bracket">{{</span><span class="cm-mw-template-ground cm-mw-pagename cm-mw-template-name">foo</span><span class="cm-mw-template-ground cm-mw-template-delimiter">|</span><span class="cm-mw-template2-ground cm-mw-template-bracket">{{</span><span class="cm-mw-template2-ground cm-mw-pagename cm-mw-template-name">bar</span><span class="cm-mw-template2-ground cm-mw-template-delimiter">|</span><span class="cm-mw-template2-link-ground cm-mw-link-bracket">[[</span><span class="cm-mw-template2-link-ground cm-mw-link-pagename cm-mw-pagename">Test</span><span class="cm-mw-template2-link-ground cm-mw-link-bracket">]]</span><span class="cm-mw-template2-ground cm-mw-template-delimiter">|</span><span class="cm-mw-template3-ground cm-mw-template-bracket">{{</span><span class="cm-mw-template3-ground cm-mw-pagename cm-mw-template-name">baz</span><span class="cm-mw-template3-ground cm-mw-template-delimiter">|</span><span class="cm-mw-template3-link-ground cm-mw-link-bracket">[[</span><span class="cm-mw-template3-link-ground cm-mw-link-pagename cm-mw-pagename">Test2</span><span class="cm-mw-template3-link-ground cm-mw-link-bracket">]]</span><span class="cm-mw-template3-ground cm-mw-template-bracket">}}</span><span class="cm-mw-template2-ground cm-mw-template-bracket">}}</span><span class="cm-mw-template-ground cm-mw-template-bracket">}}</span> </div>'
	},
	{
		title: 'Tag name followed by punctuations',
		input: '<pre-foobar><p? ><b!--',
		output: '<div class="cm-line">&lt;pre-foobar&gt;&lt;p? &gt;&lt;b!-- </div>'
	},
	{
		title: 'Localized parser function',
		input: '{{מיון רגיל:AAA}}',
		output: '<div class="cm-line"><span class="cm-mw-ext-ground cm-mw-parserfunction-bracket">{{</span><span class="cm-mw-ext-ground cm-mw-parserfunction-name">מיון רגיל</span><span class="cm-mw-ext-ground cm-mw-parserfunction-delimiter">:</span><span class="cm-mw-ext-ground cm-mw-parserfunction">AAA</span><span class="cm-mw-ext-ground cm-mw-parserfunction-bracket">}}</span> </div>'
	}
];

// Setup CodeMirror instance.
const textarea = document.createElement( 'textarea' );
document.body.appendChild( textarea );
const cm = new CodeMirror( textarea );
// Stub the config normally provided by mw.config.get('extCodeMirrorConfig')
const mwLang = mediaWikiLang( {}, {
	urlProtocols: 'ftp://|https://|news:',
	doubleUnderscore: [ {
		__notoc__: 'notoc'
	} ],
	functionSynonyms: [ {}, {
		'!': '!',
		'מיון רגיל': 'defaultsort'
	} ],
	tags: {
		nowiki: true,
		pre: true,
		ref: true,
		references: true,
		// Made-up tag, for testing when a corresponding TagMode is not configured.
		myextension: true
	},
	tagModes: {
		ref: 'mediawiki',
		references: 'mediawiki'
	}
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
					insert: input + ' '
				},
				// Above we add an extra space to the end, and here we've move the cursor there.
				// This is to avoid bracket matching and other interactive UI components
				// from showing up in the test output.
				selection: { anchor: input.length + 1 }
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
			'extNowiki',
			'extPre',
			'extTag',
			'extTagAttribute',
			'extTagBracket',
			'extTagName',
			'freeExtLink',
			'freeExtLinkProtocol',
			'htmlEntity',
			'link',
			'linkPageName',
			'nowiki',
			'pageName',
			'pre',
			'section',
			'skipFormatting',
			'strong',
			'tableCaption',
			'templateVariableDelimiter'
		] );
	} );

	it( 'configuration has a TagStyle for all expected CSS classes', () => {
		/** @type {StreamParser} */
		const mockContext = {
			tokenTable: jest.fn().mockReturnValue( Tag.define() )
		};
		const cssClasses = mwModeConfig.getTagStyles( mockContext )
			.map( ( tagStyle ) => tagStyle.class );
		expect( cssClasses ).toStrictEqual( [
			'cm-mw-apostrophes',
			'cm-mw-apostrophes-bold',
			'cm-mw-apostrophes-italic',
			'cm-mw-comment',
			'cm-mw-double-underscore',
			'cm-mw-extlink',
			'cm-mw-extlink-bracket',
			'cm-mw-extlink-protocol',
			'cm-mw-extlink-text',
			'cm-mw-hr',
			'cm-mw-htmltag-attribute',
			'cm-mw-htmltag-bracket',
			'cm-mw-htmltag-name',
			'cm-mw-indenting',
			'cm-mw-link-bracket',
			'cm-mw-link-delimiter',
			'cm-mw-link-text',
			'cm-mw-link-tosection',
			'cm-mw-list',
			'cm-mw-parserfunction',
			'cm-mw-parserfunction-bracket',
			'cm-mw-parserfunction-delimiter',
			'cm-mw-parserfunction-name',
			'cm-mw-section-header',
			'cm-mw-section-1',
			'cm-mw-section-2',
			'cm-mw-section-3',
			'cm-mw-section-4',
			'cm-mw-section-5',
			'cm-mw-section-6',
			'cm-mw-signature',
			'cm-mw-table-bracket',
			'cm-mw-table-definition',
			'cm-mw-table-delimiter',
			'cm-mw-template',
			'cm-mw-template-argument-name',
			'cm-mw-template-bracket',
			'cm-mw-template-delimiter',
			'cm-mw-pagename cm-mw-template-name',
			'cm-mw-templatevariable',
			'cm-mw-templatevariable-bracket',
			'cm-mw-templatevariable-name',
			// Custom tags
			'cm-mw-em',
			'cm-mw-error',
			'cm-mw-ext-nowiki',
			'cm-mw-ext-pre',
			'cm-mw-exttag-bracket',
			'cm-mw-exttag',
			'cm-mw-exttag-attribute',
			'cm-mw-exttag-name',
			'cm-mw-free-extlink',
			'cm-mw-free-extlink-protocol',
			'cm-mw-html-entity',
			'cm-mw-link',
			'cm-mw-link-pagename',
			'cm-mw-tag-nowiki',
			'cm-mw-pagename',
			'cm-mw-tag-pre',
			'cm-mw-section',
			'cm-mw-skipformatting',
			'cm-mw-strong',
			'cm-mw-table-caption',
			'cm-mw-templatevariable-delimiter',
			// Dynamically generated tags
			'cm-mw-ext-ground',
			'cm-mw-ext-link-ground',
			'cm-mw-ext2-ground',
			'cm-mw-ext2-link-ground',
			'cm-mw-ext3-ground',
			'cm-mw-ext3-link-ground',
			'cm-mw-link-ground',
			'cm-mw-template-ext-ground',
			'cm-mw-template-ext-link-ground',
			'cm-mw-template-ext2-ground',
			'cm-mw-template-ext2-link-ground',
			'cm-mw-template-ext3-ground',
			'cm-mw-template-ext3-link-ground',
			'cm-mw-template-ground',
			'cm-mw-template-link-ground',
			'cm-mw-template2-ext-ground',
			'cm-mw-template2-ext-link-ground',
			'cm-mw-template2-ext2-ground',
			'cm-mw-template2-ext2-link-ground',
			'cm-mw-template2-ext3-ground',
			'cm-mw-template2-ext3-link-ground',
			'cm-mw-template2-ground',
			'cm-mw-template2-link-ground',
			'cm-mw-template3-ext-ground',
			'cm-mw-template3-ext-link-ground',
			'cm-mw-template3-ext2-ground',
			'cm-mw-template3-ext2-link-ground',
			'cm-mw-template3-ext3-ground',
			'cm-mw-template3-ext3-link-ground',
			'cm-mw-template3-ground',
			'cm-mw-template3-link-ground',
			/** Added by the MW config stub above {@link mwLang} */
			'cm-mw-tag-ref',
			'cm-mw-ext-ref',
			'cm-mw-tag-references',
			'cm-mw-ext-references',
			'cm-mw-tag-myextension',
			'cm-mw-ext-myextension'
		] );
	} );
} );
