/* eslint-disable-next-line n/no-missing-require */
const { CompletionContext } = require( 'ext.CodeMirror.v6.lib' );
const CodeMirror = require( '../../resources/codemirror.js' );
const mediaWikiLang = require( '../../resources/codemirror.mediawiki.js' );
const mwModeConfig = require( '../../resources/codemirror.mediawiki.config.js' );

// Setup CodeMirror instance.
const textarea = document.createElement( 'textarea' );
document.body.appendChild( textarea );
const cm = new CodeMirror( textarea );
// Stub the config normally provided by mw.config.get('extCodeMirrorConfig')
const mwLang = mediaWikiLang( {}, {
	urlProtocols: 'ftp://|https://|news:',
	doubleUnderscore: [ {
		__notoc__: 'notoc'
	}, {} ],
	functionSynonyms: [ {
		'#special': 'special'
	}, {
		'מיון רגיל': 'defaultsort'
	} ],
	tags: { nowiki: true, indicator: true, ref: true },
	tagModes: { ref: 'text/mediawiki' }
} );
cm.initialize( [ ...cm.defaultExtensions, mwLang ] );
const [ source ] = cm.view.state.languageDataAt( 'autocomplete' );

/**
 * Create a completion context at a specific position.
 *
 * @param {boolean} explicit
 * @return {CompletionContext}
 */
const createCompletionContext = ( explicit ) => new CompletionContext(
	cm.view.state,
	/** @see https://github.com/codemirror/autocomplete/blob/62dead94d0f4b256f0b437b4733cfef6449e8453/src/completion.ts#L273 */
	cm.view.state.selection.main.from,
	explicit,
	cm.view
);

describe( 'MediaWiki autocomplete', () => {
	it( 'parser functions (explicit)', async () => {
		cm.view.dispatch( {
			changes: { from: 0, to: cm.view.state.doc.length, insert: '{{ מיון רגיל' },
			selection: { anchor: 4, head: 4 }
		} );
		expect( await source( createCompletionContext( false ) ) ).toBeNull();
		expect( await source( createCompletionContext( true ) ) ).toEqual( {
			from: 3,
			options: [
				{ label: '#special', type: 'function' },
				{ label: 'מיון רגיל', type: 'constant' }
			],
			validFor: /^[^|{}<>[\]#]*$/
		} );
	} );

	it( 'parser functions (implicit)', async () => {
		cm.view.dispatch( {
			changes: { from: 0, to: cm.view.state.doc.length, insert: '{{ #' },
			selection: { anchor: 4, head: 4 }
		} );
		expect( await source( createCompletionContext( false ) ) ).toEqual( {
			from: 3,
			options: [
				{ label: '#special', type: 'function' },
				{ label: 'מיון רגיל', type: 'constant' }
			],
			validFor: /^[^|{}<>[\]#]*$/
		} );
	} );

	it( 'behavior switch', () => {
		cm.view.dispatch( {
			changes: { from: 0, to: cm.view.state.doc.length, insert: '__no' },
			selection: { anchor: 4, head: 4 }
		} );
		expect( source( createCompletionContext( false ) ) ).toEqual( {
			from: 0,
			options: [ { label: '__notoc__', type: 'constant' } ],
			validFor: /^[^\s<>[\]{}|#]*$/
		} );
	} );

	it( 'closing nowiki tag', () => {
		cm.view.dispatch( {
			changes: { from: 0, to: cm.view.state.doc.length, insert: '<nowiki></' },
			selection: { anchor: 10, head: 10 }
		} );
		expect( source( createCompletionContext( false ) ) ).toEqual( {
			from: 10,
			options: [
				...Object.keys( mwModeConfig.permittedHtmlTags )
					.filter( ( label ) => !( label in mwModeConfig.implicitlyClosedHtmlTags ) )
					.map( ( label ) => ( { label, type: 'type', apply: `${ label }>` } ) ),
				{ label: 'nowiki', type: 'type', boost: 50, apply: 'nowiki>' }
			],
			validFor: /^[a-z\d]*$/i
		} );
	} );

	it( 'closing indicator tag', () => {
		cm.view.dispatch( {
			changes: { from: 0, to: cm.view.state.doc.length, insert: '<indicator></' },
			selection: { anchor: 13, head: 13 }
		} );
		expect( source( createCompletionContext( false ) ) ).toEqual( {
			from: 13,
			options: [
				...Object.keys( mwModeConfig.permittedHtmlTags )
					.filter( ( label ) => !( label in mwModeConfig.implicitlyClosedHtmlTags ) )
					.map( ( label ) => ( { label, type: 'type', apply: `${ label }>` } ) ),
				{ label: 'indicator', type: 'type', boost: 50, apply: 'indicator>' }
			],
			validFor: /^[a-z\d]*$/i
		} );
	} );

	it( 'closing ref tag', () => {
		cm.view.dispatch( {
			changes: { from: 0, to: cm.view.state.doc.length, insert: '<ref></' },
			selection: { anchor: 7, head: 7 }
		} );
		expect( source( createCompletionContext( false ) ) ).toEqual( {
			from: 7,
			options: [
				...Object.keys( mwModeConfig.permittedHtmlTags )
					.filter( ( label ) => !( label in mwModeConfig.implicitlyClosedHtmlTags ) )
					.map( ( label ) => ( { label, type: 'type', apply: `${ label }>` } ) ),
				{ label: 'ref', type: 'type', boost: 50, apply: 'ref>' }
			],
			validFor: /^[a-z\d]*$/i
		} );
	} );

	it( 'opening tag', () => {
		cm.view.dispatch( {
			changes: { from: 0, to: cm.view.state.doc.length, insert: '<now' },
			selection: { anchor: 4, head: 4 }
		} );
		expect( source( createCompletionContext( false ) ) ).toEqual( {
			from: 1,
			options: [
				...Object.keys( mwModeConfig.permittedHtmlTags ).map( ( label ) => ( { label, type: 'type' } ) ),
				{ label: 'nowiki', type: 'type' },
				{ label: 'indicator', type: 'type' },
				{ label: 'ref', type: 'type' }
			],
			validFor: /^[a-z\d]*$/i
		} );
	} );

	it( 'protocol', () => {
		cm.view.dispatch( {
			changes: { from: 0, to: cm.view.state.doc.length, insert: '[htt' },
			selection: { anchor: 4, head: 4 }
		} );
		expect( source( createCompletionContext( false ) ) ).toEqual( {
			from: 1,
			options: [
				{ label: 'ftp://', type: 'namespace' },
				{ label: 'https://', type: 'namespace' },
				{ label: 'news:', type: 'namespace' }
			],
			validFor: /^[a-z:/]*$/i
		} );
	} );
} );
