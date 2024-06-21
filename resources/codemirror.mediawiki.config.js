const {
	StreamParser,
	Tag,
	TagStyle,
	tags
} = require( 'ext.CodeMirror.v6.lib' );

/**
 * Configuration for the MediaWiki highlighting mode for CodeMirror.
 * This is a separate class mainly to keep static configuration out of
 * the logic in {@link CodeMirrorModeMediaWiki}.
 *
 * @module CodeMirrorModeMediaWikiConfig
 *
 * @example
 * // within MediaWiki:
 * const { mwModeConfig } = require( 'ext.CodeMirror.v6.mode.mediawiki' );
 * // Reference tags by their constants in the tags property.
 * if ( tag === mwModeConfig.tags.htmlTagBracket ) {
 *   // …
 * }
 */
class CodeMirrorModeMediaWikiConfig {

	/**
	 * @internal
	 */
	constructor() {
		this.extHighlightStyles = [];
		this.tokenTable = this.defaultTokenTable;
	}

	/**
	 * Register a token for the given tag in CodeMirror. The generated CSS class will be of
	 * the form 'cm-mw-ext-tagname'. This is for internal use to dynamically register tags
	 * from other MediaWiki extensions.
	 *
	 * @see https://www.mediawiki.org/wiki/Extension:CodeMirror#Extension_integration
	 * @param {string} tag
	 * @param {Tag} [parent]
	 * @private
	 * @internal
	 */
	addTag( tag, parent = null ) {
		if ( this.tokenTable[ `mw-tag-${ tag }` ] ) {
			return;
		}
		this.addToken( `mw-tag-${ tag }`, parent );
		this.addToken( `mw-ext-${ tag }`, parent );
	}

	/**
	 * Dynamically register a token in CodeMirror.
	 * This is solely for use by this.addTag() and CodeMirrorModeMediaWiki.makeLocalStyle().
	 *
	 * @param {string} token
	 * @param {Tag} [parent]
	 * @private
	 * @internal
	 */
	addToken( token, parent = null ) {
		if ( this.tokenTable[ token ] ) {
			return;
		}
		this.tokenTable[ token ] = Tag.define( parent );
		this.extHighlightStyles.push( {
			tag: this.tokenTable[ token ],
			class: `cm-${ token }`
		} );
	}

	/**
	 * All HTML/XML tags permitted in MediaWiki Core.
	 *
	 * Extensions should use the CodeMirrorTagModes extension attribute to register tags
	 * instead of adding them here.
	 *
	 * @see https://www.mediawiki.org/wiki/Extension:CodeMirror#Extension_integration
	 * @return {Object}
	 */
	get permittedHtmlTags() {
		return {
			b: true, bdi: true, del: true, i: true, ins: true,
			u: true, font: true, big: true, small: true, sub: true, sup: true,
			h1: true, h2: true, h3: true, h4: true, h5: true, h6: true, cite: true,
			code: true, em: true, s: true, strike: true, strong: true, tt: true,
			var: true, div: true, center: true, blockquote: true, q: true, ol: true, ul: true,
			dl: true, table: true, caption: true, pre: true, ruby: true, rb: true,
			rp: true, rt: true, rtc: true, p: true, span: true, abbr: true, dfn: true,
			kbd: true, samp: true, data: true, time: true, mark: true, br: true,
			wbr: true, hr: true, li: true, dt: true, dd: true, td: true, th: true,
			tr: true, noinclude: true, includeonly: true, onlyinclude: true
		};
	}

	/**
	 * HTML tags that are only self-closing.
	 *
	 * @return {Object}
	 */
	get implicitlyClosedHtmlTags() {
		return {
			br: true, hr: true, wbr: true
		};
	}

	/**
	 * Mapping of MediaWiki-esque token identifiers to
	 * [standardized lezer highlighting tags]{@link https://lezer.codemirror.net/docs/ref/#highlight.tags}.
	 * Values are one of the default highlighting tags. The idea is to use as many default tags as
	 * possible so that theming (such as dark mode) can be applied with minimal effort. The
	 * semantic meaning of the tag may not really match how it is used, but as per CodeMirror docs,
	 * this is fine. It's still better to make use of the standard tags in some way.
	 *
	 * Once we allow use of other themes, we may want to tweak these values for aesthetic reasons.
	 * The values here can freely be changed. The actual CSS class used is defined further down
	 * in highlightStyle().
	 *
	 * @see https://lezer.codemirror.net/docs/ref/#highlight.tags
	 * @member CodeMirrorModeMediaWikiConfig
	 * @type {Object<string>}
	 * @return {Object<string>}
	 */
	get tags() {
		return Object.assign( {
			apostrophes: 'character',
			apostrophesBold: 'strong',
			apostrophesItalic: 'emphasis',
			comment: 'comment',
			doubleUnderscore: 'controlKeyword',
			extLink: 'url',
			extLinkBracket: 'modifier',
			extLinkProtocol: 'namespace',
			extLinkText: 'labelName',
			hr: 'contentSeparator',
			htmlTagAttribute: 'attributeName',
			htmlTagBracket: 'angleBracket',
			htmlTagName: 'tagName',
			indenting: 'operatorKeyword',
			linkBracket: 'squareBracket',
			linkDelimiter: 'operator',
			linkText: 'string',
			linkToSection: 'className',
			list: 'list',
			parserFunction: 'unit',
			parserFunctionBracket: 'paren',
			parserFunctionDelimiter: 'punctuation',
			parserFunctionName: 'keyword',
			sectionHeader: 'heading',
			sectionHeader1: 'heading1',
			sectionHeader2: 'heading2',
			sectionHeader3: 'heading3',
			sectionHeader4: 'heading4',
			sectionHeader5: 'heading5',
			sectionHeader6: 'heading6',
			signature: 'quote',
			tableBracket: 'null',
			tableDefinition: 'definitionOperator',
			tableDelimiter: 'typeOperator',
			template: 'attributeValue',
			templateArgumentName: 'definitionKeyword',
			templateBracket: 'bracket',
			templateDelimiter: 'separator',
			templateName: 'moduleKeyword',
			templateVariable: 'atom',
			templateVariableBracket: 'brace',
			templateVariableName: 'variableName'
		}, this.customTags );
	}

	/**
	 * Custom tags. These are not mapped to any standard highlighting tag.
	 * These are here so that they, like tags(), serve as constants that we can
	 * reference in CodeMirrorModeMediaWiki.
	 *
	 * IMPORTANT: There should be a row in defaultTokenTable() for each of these.
	 *
	 * @return {Object<string>}
	 * @private
	 */
	get customTags() {
		return {
			em: 'mw-em',
			error: 'mw-error',
			extNowiki: 'mw-ext-nowiki',
			extPre: 'mw-ext-pre',
			extTag: 'mw-exttag',
			extTagAttribute: 'mw-exttag-attribute',
			extTagBracket: 'mw-exttag-bracket',
			extTagName: 'mw-exttag-name',
			freeExtLink: 'mw-free-extlink',
			freeExtLinkProtocol: 'mw-free-extlink-protocol',
			htmlEntity: 'mw-html-entity',
			link: 'mw-link',
			linkPageName: 'mw-link-pagename',
			nowiki: 'mw-tag-nowiki',
			pageName: 'mw-pagename',
			pre: 'mw-tag-pre',
			section: 'mw-section',
			skipFormatting: 'mw-skipformatting',
			strong: 'mw-strong',
			tableCaption: 'mw-table-caption',
			templateVariableDelimiter: 'mw-templatevariable-delimiter'
		};
	}

	/**
	 * These are custom tokens (a.k.a. tags) that aren't mapped to any of the standardized tags.
	 * Make sure these are also defined in customTags() above.
	 *
	 * TODO: pass parent Tags in Tag.define() where appropriate for better theming.
	 *
	 * @see https://codemirror.net/docs/ref/#language.StreamParser.tokenTable
	 * @see https://lezer.codemirror.net/docs/ref/#highlight.Tag%5Edefine
	 * @return {Object<Tag>}
	 * @internal
	 */
	get defaultTokenTable() {
		return {
			[ this.tags.em ]: Tag.define(),
			[ this.tags.error ]: Tag.define(),
			[ this.tags.extNowiki ]: Tag.define(),
			[ this.tags.extPre ]: Tag.define(),
			[ this.tags.extTag ]: Tag.define(),
			[ this.tags.extTagAttribute ]: Tag.define(),
			[ this.tags.extTagBracket ]: Tag.define(),
			[ this.tags.extTagName ]: Tag.define(),
			[ this.tags.freeExtLink ]: Tag.define(),
			[ this.tags.freeExtLinkProtocol ]: Tag.define(),
			[ this.tags.htmlEntity ]: Tag.define(),
			[ this.tags.link ]: Tag.define(),
			[ this.tags.linkPageName ]: Tag.define(),
			[ this.tags.nowiki ]: Tag.define(),
			[ this.tags.pageName ]: Tag.define(),
			[ this.tags.pre ]: Tag.define(),
			[ this.tags.section ]: Tag.define(),
			[ this.tags.skipFormatting ]: Tag.define(),
			[ this.tags.strong ]: Tag.define(),
			[ this.tags.tableCaption ]: Tag.define(),
			[ this.tags.templateVariableDelimiter ]: Tag.define()
		};
	}

	/**
	 * This defines the actual CSS class assigned to each tag/token.
	 * Keep this in sync and in the same order as tags().
	 *
	 * @see https://codemirror.net/docs/ref/#language.TagStyle
	 * @param {StreamParser} context
	 * @return {TagStyle[]}
	 * @internal
	 */
	getTagStyles( context ) {
		return [
			{
				tag: tags[ this.tags.apostrophes ],
				class: 'cm-mw-apostrophes'
			},
			{
				tag: tags[ this.tags.apostrophesBold ],
				class: 'cm-mw-apostrophes-bold'
			},
			{
				tag: tags[ this.tags.apostrophesItalic ],
				class: 'cm-mw-apostrophes-italic'
			},
			{
				tag: tags[ this.tags.comment ],
				class: 'cm-mw-comment'
			},
			{
				tag: tags[ this.tags.doubleUnderscore ],
				class: 'cm-mw-double-underscore'
			},
			{
				tag: tags[ this.tags.extLink ],
				class: 'cm-mw-extlink'
			},
			{
				tag: tags[ this.tags.extLinkBracket ],
				class: 'cm-mw-extlink-bracket'
			},
			{
				tag: tags[ this.tags.extLinkProtocol ],
				class: 'cm-mw-extlink-protocol'
			},
			{
				tag: tags[ this.tags.extLinkText ],
				class: 'cm-mw-extlink-text'
			},
			{
				tag: tags[ this.tags.hr ],
				class: 'cm-mw-hr'
			},
			{
				tag: tags[ this.tags.htmlTagAttribute ],
				class: 'cm-mw-htmltag-attribute'
			},
			{
				tag: tags[ this.tags.htmlTagBracket ],
				class: 'cm-mw-htmltag-bracket'
			},
			{
				tag: tags[ this.tags.htmlTagName ],
				class: 'cm-mw-htmltag-name'
			},
			{
				tag: tags[ this.tags.indenting ],
				class: 'cm-mw-indenting'
			},
			{
				tag: tags[ this.tags.linkBracket ],
				class: 'cm-mw-link-bracket'
			},
			{
				tag: tags[ this.tags.linkDelimiter ],
				class: 'cm-mw-link-delimiter'
			},
			{
				tag: tags[ this.tags.linkText ],
				class: 'cm-mw-link-text'
			},
			{
				tag: tags[ this.tags.linkToSection ],
				class: 'cm-mw-link-tosection'
			},
			{
				tag: tags[ this.tags.list ],
				class: 'cm-mw-list'
			},
			{
				tag: tags[ this.tags.parserFunction ],
				class: 'cm-mw-parserfunction'
			},
			{
				tag: tags[ this.tags.parserFunctionBracket ],
				class: 'cm-mw-parserfunction-bracket'
			},
			{
				tag: tags[ this.tags.parserFunctionDelimiter ],
				class: 'cm-mw-parserfunction-delimiter'
			},
			{
				tag: tags[ this.tags.parserFunctionName ],
				class: 'cm-mw-parserfunction-name'
			},
			{
				tag: tags[ this.tags.sectionHeader ],
				class: 'cm-mw-section-header'
			},
			{
				tag: tags[ this.tags.sectionHeader1 ],
				class: 'cm-mw-section-1'
			},
			{
				tag: tags[ this.tags.sectionHeader2 ],
				class: 'cm-mw-section-2'
			},
			{
				tag: tags[ this.tags.sectionHeader3 ],
				class: 'cm-mw-section-3'
			},
			{
				tag: tags[ this.tags.sectionHeader4 ],
				class: 'cm-mw-section-4'
			},
			{
				tag: tags[ this.tags.sectionHeader5 ],
				class: 'cm-mw-section-5'
			},
			{
				tag: tags[ this.tags.sectionHeader6 ],
				class: 'cm-mw-section-6'
			},
			{
				tag: tags[ this.tags.signature ],
				class: 'cm-mw-signature'
			},
			{
				tag: tags[ this.tags.tableBracket ],
				class: 'cm-mw-table-bracket'
			},
			{
				tag: tags[ this.tags.tableDefinition ],
				class: 'cm-mw-table-definition'
			},
			{
				tag: tags[ this.tags.tableDelimiter ],
				class: 'cm-mw-table-delimiter'
			},
			{
				tag: tags[ this.tags.template ],
				class: 'cm-mw-template'
			},
			{
				tag: tags[ this.tags.templateArgumentName ],
				class: 'cm-mw-template-argument-name'
			},
			{
				tag: tags[ this.tags.templateBracket ],
				class: 'cm-mw-template-bracket'
			},
			{
				tag: tags[ this.tags.templateDelimiter ],
				class: 'cm-mw-template-delimiter'
			},
			{
				tag: tags[ this.tags.templateName ],
				class: 'cm-mw-pagename cm-mw-template-name'
			},
			{
				tag: tags[ this.tags.templateVariable ],
				class: 'cm-mw-templatevariable'
			},
			{
				tag: tags[ this.tags.templateVariableBracket ],
				class: 'cm-mw-templatevariable-bracket'
			},
			{
				tag: tags[ this.tags.templateVariableName ],
				class: 'cm-mw-templatevariable-name'
			},

			/**
			 * Custom tags.
			 * IMPORTANT: These need to reference the CodeMirrorModeMediaWiki context.
			 */
			{
				tag: context.tokenTable[ this.tags.em ],
				class: 'cm-mw-em'
			},
			{
				tag: context.tokenTable[ this.tags.error ],
				class: 'cm-mw-error'
			},
			{
				tag: context.tokenTable[ this.tags.extNowiki ],
				class: 'cm-mw-ext-nowiki'
			},
			{
				tag: context.tokenTable[ this.tags.extPre ],
				class: 'cm-mw-ext-pre'
			},
			{
				tag: context.tokenTable[ this.tags.extTagBracket ],
				class: 'cm-mw-exttag-bracket'
			},
			{
				tag: context.tokenTable[ this.tags.extTag ],
				class: 'cm-mw-exttag'
			},
			{
				tag: context.tokenTable[ this.tags.extTagAttribute ],
				class: 'cm-mw-exttag-attribute'
			},
			{
				tag: context.tokenTable[ this.tags.extTagName ],
				class: 'cm-mw-exttag-name'
			},
			{
				tag: context.tokenTable[ this.tags.freeExtLink ],
				class: 'cm-mw-free-extlink'
			},
			{
				tag: context.tokenTable[ this.tags.freeExtLinkProtocol ],
				class: 'cm-mw-free-extlink-protocol'
			},
			{
				tag: context.tokenTable[ this.tags.htmlEntity ],
				class: 'cm-mw-html-entity'
			},
			{
				tag: context.tokenTable[ this.tags.link ],
				class: 'cm-mw-link'
			},
			{
				tag: context.tokenTable[ this.tags.linkPageName ],
				class: 'cm-mw-link-pagename'
			},
			{
				tag: context.tokenTable[ this.tags.nowiki ],
				class: 'cm-mw-tag-nowiki'
			},
			{
				tag: context.tokenTable[ this.tags.pageName ],
				class: 'cm-mw-pagename'
			},
			{
				tag: context.tokenTable[ this.tags.pre ],
				class: 'cm-mw-tag-pre'
			},
			{
				tag: context.tokenTable[ this.tags.section ],
				class: 'cm-mw-section'
			},
			{
				tag: context.tokenTable[ this.tags.skipFormatting ],
				class: 'cm-mw-skipformatting'
			},
			{
				tag: context.tokenTable[ this.tags.strong ],
				class: 'cm-mw-strong'
			},
			{
				tag: context.tokenTable[ this.tags.tableCaption ],
				class: 'cm-mw-table-caption'
			},
			{
				tag: context.tokenTable[ this.tags.templateVariableDelimiter ],
				class: 'cm-mw-templatevariable-delimiter'
			},

			...this.extHighlightStyles
		];
	}
}

/**
 * @member CodeMirrorModeMediaWikiConfig
 * @type {CodeMirrorModeMediaWikiConfig}
 */
const mwModeConfig = new CodeMirrorModeMediaWikiConfig();

module.exports = mwModeConfig;
