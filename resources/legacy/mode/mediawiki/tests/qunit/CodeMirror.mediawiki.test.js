/**
 * MediaWiki CodeMirror tests.
 */

( function () {
	/**
	 * Keys are the titles of the test cases. Each has an 'input' and the expected 'output'.
	 *
	 * @type {Object}
	 */
	const config = mw.config.get( 'extCodeMirrorConfig' ),
		extCiteLoaded = config.tagModes.ref,
		testCases = [
			{
				title: 'p tags, extra closing tag',
				input: 'this is <p><div>content</p></p>',
				output: '<pre><span>this is <span class="cm-mw-htmltag-bracket">&lt;</span><span class="cm-mw-htmltag-name">p</span><span class="cm-mw-htmltag-bracket">&gt;&lt;</span><span class="cm-mw-htmltag-name">div</span><span class="cm-mw-htmltag-bracket">&gt;</span>content<span class="cm-error">&lt;/p</span>&gt;<span class="cm-mw-htmltag-bracket">&lt;/</span><span class="cm-mw-htmltag-name">p</span><span class="cm-mw-htmltag-bracket">&gt;</span></span></pre>'
			},
			{
				title: 'HTML tag attributes',
				input: '<span title="a<b"><b title="a>b"></b></span>',
				output: '<pre><span><span class="cm-mw-htmltag-bracket">&lt;</span><span class="cm-mw-htmltag-name">span </span><span class="cm-mw-htmltag-attribute">title="a&lt;b"</span><span class="cm-mw-htmltag-bracket">&gt;&lt;</span><span class="cm-mw-htmltag-name">b </span><span class="cm-mw-htmltag-attribute">title="a</span><span class="cm-mw-htmltag-bracket">&gt;</span>b"&gt;<span class="cm-mw-htmltag-bracket">&lt;/</span><span class="cm-mw-htmltag-name">b</span><span class="cm-mw-htmltag-bracket">&gt;&lt;/</span><span class="cm-mw-htmltag-name">span</span><span class="cm-mw-htmltag-bracket">&gt;</span></span></pre>'
			},
			{
				title: 'ref tag attributes',
				input: '<ref name="a<b"/>',
				output: extCiteLoaded ?
					'<pre><span><span class="cm-mw-exttag-bracket cm-mw-ext-ref">&lt;</span><span class="cm-mw-exttag-name cm-mw-ext-ref">ref </span><span class="cm-mw-exttag-attribute cm-mw-ext-ref">name="a&lt;b"</span><span class="cm-mw-exttag-bracket cm-mw-ext-ref">/&gt;</span></span></pre>' :
					'<pre><span>&lt;ref name="a&lt;b"/&gt;</span></pre>'
			},
			{
				title: 'indented table with caption and inline headings',
				input: ' ::{| class="wikitable"\n |+ Caption\n |-\n ! Uno !! Dos\n |-\n | Foo || Bar\n |}',
				output: '<pre><span><span class="cm-mw-indenting"> ::</span><span class="cm-mw-table-bracket">{| </span><span class="cm-mw-table-definition">class="wikitable"</span></span></pre><pre><span><span class="cm-mw-table-delimiter"> |+ </span><span class="cm-mw-table-caption">Caption</span></span></pre><pre><span><span class="cm-mw-table-delimiter"> |-</span></span></pre><pre><span><span class="cm-mw-table-delimiter"> ! </span><span class="cm-strong">Uno </span><span class="cm-mw-table-delimiter">!!</span><span class="cm-strong"> Dos</span></span></pre><pre><span><span class="cm-mw-table-delimiter"> |-</span></span></pre><pre><span><span class="cm-mw-table-delimiter"> | </span>Foo <span class="cm-mw-table-delimiter">||</span> Bar</span></pre><pre><span><span class="cm-mw-table-bracket"> |}</span></span></pre>'
			},
			{
				title: 'apostrophe before italic',
				input: 'plain l\'\'\'italic\'\'plain',
				output: '<pre><span>plain l\'<span class="cm-mw-apostrophes-italic">\'\'</span><span class=" cm-em">italic</span><span class="cm-mw-apostrophes-italic">\'\'</span>plain</span></pre>'
			},
			{
				title: 'free external links',
				input: 'https://wikimedia.org [ftp://foo.bar FOO] //archive.org',
				output: '<pre><span><span class="cm-mw-free-extlink-protocol">https://</span><span class="cm-mw-free-extlink">wikimedia.org</span> <span class="cm-mw-link-ground cm-mw-extlink-bracket">[</span><span class="cm-mw-link-ground cm-mw-extlink-protocol">ftp://</span><span class="cm-mw-link-ground cm-mw-extlink">foo.bar</span><span class="cm-mw-link-ground "> </span><span class="cm-mw-link-ground cm-mw-extlink-text">FOO</span><span class="cm-mw-link-ground cm-mw-extlink-bracket">]</span> //archive.org</span></pre>'
			},
			{
				title: 'void tags',
				input: 'a<br>b</br>c a<div>b<br>c</div>d',
				output: '<pre><span>a<span class="cm-mw-htmltag-bracket">&lt;</span><span class="cm-mw-htmltag-name">br</span><span class="cm-mw-htmltag-bracket">&gt;</span>b<span class="cm-error">&lt;/br</span>&gt;c a<span class="cm-mw-htmltag-bracket">&lt;</span><span class="cm-mw-htmltag-name">div</span><span class="cm-mw-htmltag-bracket">&gt;</span>b<span class="cm-mw-htmltag-bracket">&lt;</span><span class="cm-mw-htmltag-name">br</span><span class="cm-mw-htmltag-bracket">&gt;</span>c<span class="cm-mw-htmltag-bracket">&lt;/</span><span class="cm-mw-htmltag-name">div</span><span class="cm-mw-htmltag-bracket">&gt;</span>d</span></pre>'
			},
			{
				title: 'magic words',
				input: '__NOTOC__',
				output: '<pre><span><span class="cm-mw-doubleUnderscore">__NOTOC__</span></span></pre>'
			},
			{
				title: 'nowiki',
				input: '<nowiki>{{foo}}<p> </div> {{{</nowiki>',
				output: '<pre><span><span class="cm-mw-exttag-bracket cm-mw-ext-nowiki">&lt;</span><span class="cm-mw-exttag-name cm-mw-ext-nowiki">nowiki</span><span class="cm-mw-exttag-bracket cm-mw-ext-nowiki">&gt;</span><span class="cm-mw-tag-nowiki cm-mw-tag-nowiki">{{foo}}&lt;p&gt; &lt;/div&gt; {{{</span><span class="cm-mw-exttag-bracket cm-mw-ext-nowiki">&lt;/</span><span class="cm-mw-exttag-name cm-mw-ext-nowiki">nowiki</span><span class="cm-mw-exttag-bracket cm-mw-ext-nowiki">&gt;</span></span></pre>'
			},
			{
				title: 'ref tag with cite web, extraneous curly braces',
				input: '<ref>{{cite web|2=foo}}}}</ref>',
				output: extCiteLoaded ?
					'<pre><span><span class="cm-mw-exttag-bracket cm-mw-ext-ref">&lt;</span><span class="cm-mw-exttag-name cm-mw-ext-ref">ref</span><span class="cm-mw-exttag-bracket cm-mw-ext-ref">&gt;</span><span class="cm-mw-tag-ref cm-mw-template-ground cm-mw-template-bracket">{{</span><span class="cm-mw-tag-ref cm-mw-template-ground cm-mw-template-name cm-mw-pagename">cite web</span><span class="cm-mw-tag-ref cm-mw-template-ground cm-mw-template-delimiter">|</span><span class="cm-mw-tag-ref cm-mw-template-ground cm-mw-template-argument-name">2=</span><span class="cm-mw-tag-ref cm-mw-template-ground cm-mw-template">foo</span><span class="cm-mw-tag-ref cm-mw-template-ground cm-mw-template-bracket">}}</span><span class="cm-mw-tag-ref ">}}</span><span class="cm-mw-exttag-bracket cm-mw-ext-ref">&lt;/</span><span class="cm-mw-exttag-name cm-mw-ext-ref">ref</span><span class="cm-mw-exttag-bracket cm-mw-ext-ref">&gt;</span></span></pre>' :
					'<pre><span>&lt;ref&gt;<span class="cm-mw-template-ground cm-mw-template-bracket">{{</span><span class="cm-mw-template-ground cm-mw-template-name cm-mw-pagename">cite web</span><span class="cm-mw-template-ground cm-mw-template-delimiter">|</span><span class="cm-mw-template-ground cm-mw-template-argument-name">2=</span><span class="cm-mw-template-ground cm-mw-template">foo</span><span class="cm-mw-template-ground cm-mw-template-bracket">}}</span>}}&lt;/ref&gt;</span></pre>'
			},
			{
				title: 'template with params and parser function',
				input: '{{foo|1=bar|2={{{param|blah}}}|{{#if:{{{3|}}}|yes|no}}}}',
				output: '<pre><span><span class="cm-mw-template-ground cm-mw-template-bracket">{{</span><span class="cm-mw-template-ground cm-mw-template-name cm-mw-pagename">foo</span><span class="cm-mw-template-ground cm-mw-template-delimiter">|</span><span class="cm-mw-template-ground cm-mw-template-argument-name">1=</span><span class="cm-mw-template-ground cm-mw-template">bar</span><span class="cm-mw-template-ground cm-mw-template-delimiter">|</span><span class="cm-mw-template-ground cm-mw-template-argument-name">2=</span><span class="cm-mw-template-ground cm-mw-templatevariable-bracket">{{{</span><span class="cm-mw-template-ground cm-mw-templatevariable-name">param</span><span class="cm-mw-template-ground cm-mw-templatevariable-delimiter">|</span><span class="cm-mw-template-ground cm-mw-templatevariable">blah</span><span class="cm-mw-template-ground cm-mw-templatevariable-bracket">}}}</span><span class="cm-mw-template-ground cm-mw-template-delimiter">|</span><span class="cm-mw-template-ext-ground cm-mw-parserfunction-bracket">{{</span><span class="cm-mw-template-ext-ground cm-mw-parserfunction-name">#if</span><span class="cm-mw-template-ext-ground cm-mw-parserfunction-delimiter">:</span><span class="cm-mw-template-ext-ground cm-mw-templatevariable-bracket">{{{</span><span class="cm-mw-template-ext-ground cm-mw-templatevariable-name">3</span><span class="cm-mw-template-ext-ground cm-mw-templatevariable-delimiter">|</span><span class="cm-mw-template-ext-ground cm-mw-templatevariable-bracket">}}}</span><span class="cm-mw-template-ext-ground cm-mw-parserfunction-delimiter">|</span><span class="cm-mw-template-ext-ground cm-mw-parserfunction">yes</span><span class="cm-mw-template-ext-ground cm-mw-parserfunction-delimiter">|</span><span class="cm-mw-template-ext-ground cm-mw-parserfunction">no</span><span class="cm-mw-template-ext-ground cm-mw-parserfunction-bracket">}}</span><span class="cm-mw-template-ground cm-mw-template-bracket">}}</span></span></pre>'
			},
			{
				title: 'T277767: newlines and comments in template names',
				input: '{{#if: | {{some template\n<!-- comment --> }} }}',
				output: '<pre><span><span class="cm-mw-ext-ground cm-mw-parserfunction-bracket">{{</span><span class="cm-mw-ext-ground cm-mw-parserfunction-name">#if</span><span class="cm-mw-ext-ground cm-mw-parserfunction-delimiter">:</span><span class="cm-mw-ext-ground cm-mw-parserfunction"> </span><span class="cm-mw-ext-ground cm-mw-parserfunction-delimiter">|</span><span class="cm-mw-ext-ground cm-mw-parserfunction"> </span><span class="cm-mw-template-ext-ground cm-mw-template-bracket">{{</span><span class="cm-mw-template-ext-ground cm-mw-template-name cm-mw-pagename">some template</span></span></pre><pre><span><span class="cm-mw-template-ext-ground cm-mw-comment">&lt;!-- comment --&gt;</span><span class="cm-mw-template-ext-ground cm-mw-template-bracket"> }}</span><span class="cm-mw-ext-ground cm-mw-parserfunction"> </span><span class="cm-mw-ext-ground cm-mw-parserfunction-bracket">}}</span></span></pre>'
			},
			{
				title: 'T108450: template transclusion where the template name is a parameter',
				input: '{{{{{1}}}|…}}',
				output: '<pre><span><span class="cm-mw-template-ground cm-mw-template-bracket">{{</span><span class="cm-mw-template-ground cm-mw-templatevariable-bracket">{{{</span><span class="cm-mw-template-ground cm-mw-templatevariable-name">1</span><span class="cm-mw-template-ground cm-mw-templatevariable-bracket">}}}</span><span class="cm-mw-template-ground cm-mw-template-delimiter">|</span><span class="cm-mw-template-ground cm-mw-template">…</span><span class="cm-mw-template-ground cm-mw-template-bracket">}}</span></span></pre>'
			},
			{
				title: 'T292967: table syntax where all | are escaped with the {{!}} parser function',
				input: '{{{!}} class="wikitable"\n! header\n{{!}}-\n{{!}} cell\n{{!}}}',
				output: '<pre><span>{<span class="cm-mw-ext-ground cm-mw-parserfunction-bracket">{{</span><span class="cm-mw-ext-ground cm-mw-parserfunction-name">!</span><span class="cm-mw-ext-ground cm-mw-parserfunction-bracket">}}</span> class="wikitable"</span></pre><pre><span>! header</span></pre><pre><span><span class="cm-mw-ext-ground cm-mw-parserfunction-bracket">{{</span><span class="cm-mw-ext-ground cm-mw-parserfunction-name">!</span><span class="cm-mw-ext-ground cm-mw-parserfunction-bracket">}}</span>-</span></pre><pre><span><span class="cm-mw-ext-ground cm-mw-parserfunction-bracket">{{</span><span class="cm-mw-ext-ground cm-mw-parserfunction-name">!</span><span class="cm-mw-ext-ground cm-mw-parserfunction-bracket">}}</span> cell</span></pre><pre><span><span class="cm-mw-ext-ground cm-mw-parserfunction-bracket">{{</span><span class="cm-mw-ext-ground cm-mw-parserfunction-name">!</span><span class="cm-mw-ext-ground cm-mw-parserfunction-bracket">}}</span>}</span></pre>'
			},
			{
				title: 'section headings',
				input: '== My section ==\nFoo bar\n=== Blah ===\nBaz\n= { =\nText',
				output: '<pre class=" cm-mw-section-2 CodeMirror-line "><span><span class="cm-mw-section-header">==</span> My section <span class="cm-mw-section-header">==</span></span></pre><pre><span>Foo bar</span></pre><pre class=" cm-mw-section-3 CodeMirror-line "><span><span class="cm-mw-section-header">===</span> Blah <span class="cm-mw-section-header">===</span></span></pre><pre><span>Baz</span></pre><pre class=" cm-mw-section-1 CodeMirror-line "><span><span class="cm-mw-section-header">=</span> { <span class="cm-mw-section-header">=</span></span></pre><pre><span>Text</span></pre>'
			},
			{
				title: 'section headings with trailing comments',
				input: '== My section == <!-- comment --> \nFoo bar\n=== Blah ===<!--comment-->\nBaz\n== <i>a</i> <!-- comment --> == <!--comment-->',
				output: '<pre class=" cm-mw-section-2 CodeMirror-line "><span><span class="cm-mw-section-header">==</span> My section <span class="cm-mw-section-header">== </span><span class="cm-mw-comment">&lt;!-- comment --&gt;</span> </span></pre><pre><span>Foo bar</span></pre><pre class=" cm-mw-section-3 CodeMirror-line "><span><span class="cm-mw-section-header">===</span> Blah <span class="cm-mw-section-header">===</span><span class="cm-mw-comment">&lt;!--comment--&gt;</span></span></pre><pre><span>Baz</span></pre><pre class=" cm-mw-section-2 CodeMirror-line "><span><span class="cm-mw-section-header">==</span> <span class="cm-mw-htmltag-bracket">&lt;</span><span class="cm-mw-htmltag-name">i</span><span class="cm-mw-htmltag-bracket">&gt;</span>a<span class="cm-mw-htmltag-bracket">&lt;/</span><span class="cm-mw-htmltag-name">i</span><span class="cm-mw-htmltag-bracket">&gt;</span> <span class="cm-mw-comment">&lt;!-- comment --&gt;</span> <span class="cm-mw-section-header">== </span><span class="cm-mw-comment">&lt;!--comment--&gt;</span></span></pre>'
			},
			{
				title: 'bullets and numbering, with invalid leading spacing',
				input: '* bullet A\n* bullet B\n# one\n # two',
				output: '<pre><span><span class="cm-mw-list">*</span> bullet A</span></pre><pre><span><span class="cm-mw-list">*</span> bullet B</span></pre><pre><span><span class="cm-mw-list">#</span> one</span></pre><pre><span><span class="cm-mw-skipformatting"> </span># two</span></pre>'
			},
			{
				title: 'link with bold text',
				input: '[[Link title|\'\'\'bold link\'\'\']]',
				output: '<pre><span><span class="cm-mw-link-ground cm-mw-link-bracket">[[</span><span class="cm-mw-link-ground cm-mw-link-pagename cm-mw-pagename">Link title</span><span class="cm-mw-link-ground cm-mw-link-delimiter">|</span><span class="cm-mw-link-ground cm-mw-link-text cm-mw-apostrophes">\'\'\'</span><span class="cm-mw-link-ground cm-mw-link-text cm-strong">bold link</span><span class="cm-mw-link-ground cm-mw-link-text cm-mw-apostrophes">\'\'\'</span><span class="cm-mw-link-ground cm-mw-link-bracket">]]</span></span></pre>'
			},
			{
				title: 'horizontal rule',
				input: 'One\n----\nTwo',
				output: '<pre><span>One</span></pre><pre><span><span class="cm-mw-hr">----</span></span></pre><pre><span>Two</span></pre>'
			},
			{
				title: 'comments',
				input: '<!-- foo [[bar]] {{{param}}} -->',
				output: '<pre><span><span class="cm-mw-comment">&lt;!-- foo [[bar]] {{{param}}} --&gt;</span></span></pre>'
			},
			{
				title: 'signatures',
				input: 'my sig ~~~ ~~~~ ~~~~~~~',
				output: '<pre><span>my sig <span class="cm-mw-signature">~~~</span> <span class="cm-mw-signature">~~~~</span> <span class="cm-mw-signature">~~~~~</span>~~</span></pre>'
			},
			{
				title: 'new',
				input: '<ref></Ref>',
				output: extCiteLoaded ?
					'<pre><span><span class="cm-mw-exttag-bracket cm-mw-ext-ref">&lt;</span><span class="cm-mw-exttag-name cm-mw-ext-ref">ref</span><span class="cm-mw-exttag-bracket cm-mw-ext-ref">&gt;&lt;/</span><span class="cm-mw-exttag-name cm-mw-ext-Ref">Ref</span><span class="cm-mw-exttag-bracket cm-mw-ext-Ref">&gt;</span></span></pre>' :
					'<pre><span>&lt;ref&gt;&lt;/Ref&gt;</span></pre>'
			},
			{
				title: 'multi-line tag',
				input: '<div\nid="foo"\n>bar</div>',
				output: '<pre><span><span class="cm-mw-htmltag-bracket">&lt;</span><span class="cm-mw-htmltag-name">div</span></span></pre><pre><span><span class="cm-mw-htmltag-attribute">id="foo"</span></span></pre><pre><span><span class="cm-mw-htmltag-bracket">&gt;</span>bar<span class="cm-mw-htmltag-bracket">&lt;/</span><span class="cm-mw-htmltag-name">div</span><span class="cm-mw-htmltag-bracket">&gt;</span></span></pre>'
			}
		];

	QUnit.module( 'ext.CodeMirror.mediawiki.test', QUnit.newMwEnvironment() );

	/**
	 * For some reason in QUnit we have to make the textarea, and supply it with the
	 * wikitext prior to initializing CodeMirror. So this function will do this and
	 * destroy CodeMirror after the test has completed, so that we have a clean slate
	 * for the next iteration.
	 *
	 * @param {string} wikitext
	 * @param {Function} callback Ran after CodeMirror has been initialized.
	 */
	function setup( wikitext, callback ) {
		const $textarea = $( '<textarea>' );

		$textarea.val( wikitext );
		$( '#qunit-fixture' ).append( $textarea );

		CodeMirror.fromTextArea( $textarea[ 0 ], {
			mwConfig: config,
			lineWrapping: true,
			readOnly: false,
			mode: 'text/mediawiki',
			inputStyle: 'contenteditable',
			viewportMargin: Infinity
		} );

		callback();

		// Tear down.
		$textarea.remove();
		$( '#qunit-fixture' ).find( '.CodeMirror' ).remove();
	}

	testCases.forEach( ( testCase ) => {
		QUnit.test( 'Syntax highlighting: ' + testCase.title, ( assert ) => mw.loader.using( config.pluginModules ).then( () => {
			setup( testCase.input, () => {
				const html = $( '.CodeMirror-code' ).html()
				// CodeMirror does this only on WebKit browsers. Strip it to ensure tests
				// pass across all browsers.
					.replace( / style="padding-right: 0\.1px;"/g, '' )
				// Reduce noise we don't really care about to make tests more readable.
					.replace( / role="presentation"/g, '' )
					.replace( / class="\s*CodeMirror-line\s*"/g, '' );
				assert.strictEqual(
					html,
					testCase.output,
					'Textarea contents'
				);
			} );
		} ) );
	} );
}() );
