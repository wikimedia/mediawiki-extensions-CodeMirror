const CodeMirror = require( '../../../resources/codemirror.js' );
const mediawikiLang = require( '../../../resources/modes/mediawiki/codemirror.mediawiki.js' );

describe( 'CodeMirrorOpenLinks', () => {
	let cm;

	beforeEach( () => {
		const textarea = document.createElement( 'textarea' );
		document.body.appendChild( textarea );
		cm = new CodeMirror( textarea, mediawikiLang() );
		cm.initialize();
		cm.textSelection.setContents( '[[Foo]] {{bar}} https://example.org' );
	} );

	it( 'should add .cm-mw-open-links to page titles', () => {
		cm.view.contentDOM.dispatchEvent( new KeyboardEvent( 'keydown', { key: 'Control', bubbles: true } ) );
		expect( cm.view.contentDOM.classList ).toContain( 'cm-mw-open-links' );
		cm.view.contentDOM.dispatchEvent( new KeyboardEvent( 'keyup', { key: 'Control', bubbles: true } ) );
		expect( cm.view.contentDOM.classList ).not.toContain( 'cm-mw-open-links' );
	} );

	it( 'should remove .cm-mw-open-links if the document becomes hidden', () => {
		cm.view.contentDOM.dispatchEvent( new KeyboardEvent( 'keydown', { key: 'Control', bubbles: true } ) );
		expect( cm.view.contentDOM.classList ).toContain( 'cm-mw-open-links' );
		expect( document.hidden ).toBe( false );
		Object.defineProperty( document, 'hidden', { value: true, writable: true } );
		document.dispatchEvent( new Event( 'visibilitychange' ) );
		expect( cm.view.contentDOM.classList ).not.toContain( 'cm-mw-open-links' );
		// Reset the hidden property
		Object.defineProperty( document, 'hidden', { value: false, writable: true } );
	} );
} );
