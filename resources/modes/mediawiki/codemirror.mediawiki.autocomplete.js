const {
	CompletionSource,
	EditorSelection,
	Extension,
	autocompletion,
	insertCompletionText,
	pickedCompletion,
	syntaxTree
} = require( 'ext.CodeMirror.v6.lib' );
const mwModeConfig = require( './codemirror.mediawiki.config.js' );

/**
 * CodeMirror extension providing
 * autocompletion
 * for the MediaWiki mode. This automatically applied when using {@link CodeMirrorMediaWiki}.
 *
 * @module CodeMirrorAutocomplete
 * @type {Extension}
 */
const autocompleteExtension = [
	autocompletion( { defaultKeymap: true } )
];

/**
 * Check if the node has a specific type.
 *
 * @param {Set<string>} types
 * @param {string[]|string} names
 * @return {boolean}
 */
const hasTag = ( types, names ) => ( Array.isArray( names ) ? names : [ names ] )
	.some( ( name ) => types.has( mwModeConfig.tags[ name ] ) );

const api = new mw.Api( { parameters: { formatversion: 2 } } ),
	title = mw.config.get( 'wgPageName' );

/**
 * Get suggestions for wiki links.
 *
 * @param {string} search
 * @param {number} namespace
 * @param {boolean} subpage
 * @return {Promise<string[]>}
 */
const linkSuggestFactory = ( search, namespace = 0, subpage = false ) => {
	if ( subpage ) {
		search = title + search;
	}
	return api.get( { action: 'opensearch', search, namespace, limit: 'max' } )
		.then( ( [ , pages ] ) => {
			if ( subpage ) {
				const { length } = title;
				return pages.map( ( page ) => page.slice( length ) );
			}
			return namespace === 0 ?
				pages.map( ( page ) => page ) :
				pages.map( ( page ) => new mw.Title( page ).getMainText() );
		} ).catch( () => [] );
};

/**
 * Autocompletion for page names.
 *
 * @param {CodeMirrorMediaWiki} mode
 * @param {string} str
 * @param {number} ns
 * @return {Promise}
 */
const linkSuggest = ( mode, str, ns = 0 ) => {
	const { config: { titleCompletion }, nsRegex } = mode;
	if ( !titleCompletion || /[|{}<>[\]#]/.test( str ) ) {
		return Promise.resolve( undefined );
	}
	let subpage = false,
		search = str,
		offset = 0;
	if ( search.startsWith( '/' ) ) {
		ns = 0;
		subpage = true;
	} else {
		search = search.replace( /_/g, ' ' );
		const mt = /^\s*/.exec( search );
		[ { length: offset } ] = mt;
		search = search.slice( offset );
		if ( search.startsWith( ':' ) ) {
			const [ { length } ] = /^:\s*/.exec( search );
			offset += length;
			search = search.slice( length );
			ns = 0;
		}
		if ( !search ) {
			return Promise.resolve( undefined );
		}
		const mt2 = nsRegex.exec( search );
		if ( mt2 ) {
			const [ { length }, prefix ] = mt2;
			offset += length;
			search = `${ prefix }:${ search.slice( length ) }`;
			ns = 1;
		}
	}
	const underscore = str.slice( offset ).includes( '_' );
	return linkSuggestFactory( search, ns, subpage ).then( ( pages ) => ( {
		offset,
		options: pages.map( ( label ) => ( {
			type: 'text',
			label: underscore ? label.replace( / /g, '_' ) : label
		} ) )
	} ) );
};

/**
 * Apply autocompletion for links.
 *
 * @param {boolean} closed
 * @return {Function}
 */
const applyLinkCompletion = ( closed ) => ( view, completion, from, to ) => {
	let { label } = completion;
	const initial = label.charAt( 0 ).toLowerCase();
	if ( view.state.sliceDoc( from, from + 1 ) === initial ) {
		label = initial + label.slice( 1 );
	}
	view.dispatch( Object.assign(
		insertCompletionText( view.state, label + ( closed ? '' : ']]' ), from, to ),
		{
			selection: EditorSelection.cursor( from + label.length ),
			annotations: pickedCompletion.of( completion )
		}
	) );
};

/**
 * Apply autocompletion for templates.
 *
 * @param {boolean} closed
 * @return {Function}
 */
const applyTemplateCompletion = ( closed ) => ( view, completion, from, to ) => {
	const { label } = completion;
	view.dispatch( Object.assign(
		insertCompletionText( view.state, label + ( closed ? '' : '}}' ), from, to ),
		{
			selection: EditorSelection.cursor( from + label.length ),
			annotations: pickedCompletion.of( completion )
		}
	) );
};

/**
 * Autocompletion for magic words, tag names, etc.
 *
 * @param {CodeMirrorMediaWiki} mode
 * @return {CompletionSource}
 */
const completionSource = ( mode ) => ( context ) => {
	const { state, pos, explicit } = context,
		node = syntaxTree( state ).resolve( pos, -1 ),
		types = new Set( node.name.split( '_' ) ),
		isParserFunction = hasTag( types, 'parserFunctionName' ),
		{ from } = node,
		search = state.sliceDoc( from, pos );
	if ( explicit || isParserFunction && search.includes( '#' ) ) {
		const validFor = /^[^|{}<>[\]#]*$/;
		if ( isParserFunction || hasTag( types, 'templateName' ) ) {
			const options = search.includes( ':' ) ? [] : [ ...mode.functionSynonyms ],
				apply = applyTemplateCompletion( /^\s*[|}]/.test( state.sliceDoc( pos ) ) );
			return linkSuggest( mode, search, 10 )
				.then( ( suggestions = { offset: 0, options: [] } ) => {
					options.push( ...suggestions.options
						.map( ( option ) => Object.assign( option, { apply } ) ) );
					return options.length === 0 ?
						null :
						{ from: from + suggestions.offset, options, validFor };
				} );
		}
		if ( hasTag( types, 'linkPageName' ) ) {
			const apply = applyLinkCompletion( /^\s*[|\]]/.test( state.sliceDoc( pos ) ) );
			return linkSuggest( mode, search ).then( ( suggestions ) => suggestions ? {
				from: from + suggestions.offset,
				options: suggestions.options
					.map( ( option ) => Object.assign( option, { apply } ) ),
				validFor
			} : null );
		}
	}
	if ( !hasTag( types, [
		'comment',
		'templateVariableName',
		'templateName',
		'linkPageName',
		'linkToSection',
		'extLink'
	] ) ) {
		let mt = context.matchBefore( /__(?:(?!__)[^\s<>[\]{}|#])*$/ );
		if ( mt ) {
			return {
				from: mt.from,
				options: mode.doubleUnderscore,
				validFor: /^[^\s<>[\]{}|#]*$/
			};
		}
		mt = context.matchBefore( /<\/?[a-z\d]*$/i );
		const extTags = [ ...types ].filter( ( t ) => t.startsWith( 'mw-tag-' ) )
			.map( ( s ) => s.slice( 7 ) );
		if ( hasTag( types, 'extTag' ) ) {
			let { prevSibling } = node;
			while ( prevSibling &&
				!prevSibling.name.split( '_' ).includes( mwModeConfig.tags.extTagName ) ) {
				( { prevSibling } = prevSibling );
			}
			if ( prevSibling ) {
				extTags.push(
					state.sliceDoc( prevSibling.from, prevSibling.to ).trim().toLowerCase()
				);
			}
		}
		if ( mt && mt.to - mt.from > 1 ) {
			const validFor = /^[a-z\d]*$/i;
			if ( mt.text[ 1 ] === '/' ) {
				const extTag = extTags[ extTags.length - 1 ],
					closed = /^\s*>/.test( state.sliceDoc( pos ) ),
					options = [
						...mode.htmlTags.filter( ( { label } ) => !(
							label in mwModeConfig.implicitlyClosedHtmlTags
						) ),
						...extTag ? [ { type: 'type', label: extTag, boost: 50 } ] : []
					];
				return {
					from: mt.from + 2,
					options: closed ? options : options.map( ( option ) => Object.assign( {
						apply: `${ option.label }>`
					}, option ) ),
					validFor
				};
			}
			return {
				from: mt.from + 1,
				options: [
					...mode.htmlTags,
					...mode.extTags.filter( ( { label } ) => !extTags.includes( label ) )
				],
				validFor
			};
		}
		if ( !hasTag( types, [ 'linkText', 'extLinkText' ] ) ) {
			mt = context.matchBefore( /(?:^|[^[])\[[a-z:/]+$/i );
			if ( mt ) {
				return {
					from: mt.from + ( mt.text[ 1 ] === '[' ? 2 : 1 ),
					options: mode.protocols,
					validFor: /^[a-z:/]*$/i
				};
			}
		}
	}
	return null;
};

module.exports = {
	autocompleteExtension,
	completionSource
};
