const CodeMirror = require( '../../resources/codemirror.js' );
const mediawikiLang = require( '../../resources/codemirror.mediawiki.js' );

describe( 'CodeMirrorOpenLinks', () => {
	let cm;

	beforeEach( () => {
		const textarea = document.createElement( 'textarea' );
		document.body.appendChild( textarea );
		cm = new CodeMirror( textarea );
		cm.initialize( [ ...cm.defaultExtensions, mediawikiLang( {}, {
			tags: {},
			functionSynonyms: [ {}, {} ],
			doubleUnderscore: [ {}, {} ],
			urlProtocols: 'https://'
		} ) ] );
		cm.textSelection.setContents( '[[Foo]] {{bar}} https://example.org' );
	} );

	it( 'should add .cm-mw-open-links to page titles', () => {
		cm.view.contentDOM.dispatchEvent( new KeyboardEvent( 'keydown', { key: 'Control', bubbles: true } ) );
		expect( cm.view.contentDOM.classList ).toContain( 'cm-mw-open-links' );
		cm.view.contentDOM.dispatchEvent( new KeyboardEvent( 'keyup', { key: 'Control', bubbles: true } ) );
		expect( cm.view.contentDOM.classList ).not.toContain( 'cm-mw-open-links' );
	} );
} );
