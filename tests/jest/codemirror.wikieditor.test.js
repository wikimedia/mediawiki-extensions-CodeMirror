mw.loader = { getState: jest.fn() };

const CodeMirrorWikiEditor = require( '../../resources/codemirror.wikieditor.js' ),
	mediaWikiLang = require( '../../resources/codemirror.mediawiki.js' ),
	$textarea = $( '<textarea>' )
		.text( 'The Smashing Pumpkins' ),
	cmWe = new CodeMirrorWikiEditor( $textarea );

beforeEach( () => {
	// Simulate the button that enables/disables CodeMirror as WikiEditor doesn't exist here.
	const btn = document.createElement( 'span' );
	btn.id = 'mw-editbutton-codemirror';
	btn.classList.add( 'tool' );
	btn.setAttribute( 'rel', 'CodeMirror' );
	document.body.appendChild( btn );

	// Add WikiEditor context to the textarea.
	cmWe.$textarea.data = jest.fn().mockReturnValue( {
		modules: {
			toolbar: {
				$toolbar: $( btn )
			}
		}
	} );

	// Initialize CodeMirror.
	cmWe.initialize();
} );

describe( 'addCodeMirrorToWikiEditor', () => {
	cmWe.$textarea.wikiEditor = jest.fn();

	it( 'should add the button to the toolbar', () => {
		cmWe.addCodeMirrorToWikiEditor();
		expect( cmWe.$textarea.wikiEditor ).toHaveBeenCalledWith(
			'addToToolbar',
			expect.objectContaining( {
				groups: { codemirror: expect.any( Object ) }
			} )
		);
	} );

	it( 'should be readonly when the textarea is also readonly', () => {
		const textarea = document.createElement( 'textarea' );
		textarea.readOnly = true;
		const cmWe2 = new CodeMirrorWikiEditor( textarea );
		cmWe2.initialize();
		cmWe2.addCodeMirrorToWikiEditor();
		expect( cmWe2.readOnly ).toEqual( true );
		expect( cmWe2.state.readOnly ).toEqual( true );
	} );
} );

describe( 'updateToolbarButton', () => {
	it( 'should update the toolbar button based on the current CodeMirror state', () => {
		const btn = document.getElementById( 'mw-editbutton-codemirror' );
		cmWe.setCodeMirrorPreference( false );
		cmWe.updateToolbarButton();
		expect( btn.classList.contains( 'mw-editbutton-codemirror-active' ) ).toBeFalsy();
		cmWe.setCodeMirrorPreference( true );
		cmWe.updateToolbarButton();
		expect( btn.classList.contains( 'mw-editbutton-codemirror-active' ) ).toBeTruthy();
	} );
} );

describe( 'Hook handlers and event listeners', () => {
	const textarea = document.createElement( 'textarea' ),
		editform = document.createElement( 'form' ),
		events = {};
	editform.append( textarea );
	editform.addEventListener = jest.fn( ( event, callback ) => {
		events[ event ] = callback;
	} );
	editform.removeEventListener = jest.fn( ( event ) => {
		delete events[ event ];
	} );
	const cmWe3 = new CodeMirrorWikiEditor( textarea );
	cmWe3.langExtension = mediaWikiLang( {
		bidiIsolation: false
	}, {
		tags: {},
		functionSynonyms: [ {}, {} ],
		variableIDs: [],
		doubleUnderscore: [ {}, {} ],
		urlProtocols: 'http://'
	} );
	cmWe3.$textarea.wikiEditor = jest.fn();

	it( 'should remove submit event listener when CodeMirror is off', () => {
		cmWe3.switchCodeMirror();
		expect( typeof events.submit ).toBe( 'function' );
		cmWe3.switchCodeMirror();
		expect( events.submit ).toBeUndefined();
	} );

	it( 'should remove realtime preview hook handler when CodeMirror is off', () => {
		cmWe3.switchCodeMirror();
		expect( mw.hook.mockHooks[ 'ext.WikiEditor.realtimepreview.enable' ].length ).toBe( 1 );
		expect( mw.hook.mockHooks[ 'ext.WikiEditor.realtimepreview.disable' ].length ).toBe( 1 );
		cmWe3.switchCodeMirror();
		expect( mw.hook.mockHooks[ 'ext.WikiEditor.realtimepreview.enable' ].length ).toBe( 0 );
		expect( mw.hook.mockHooks[ 'ext.WikiEditor.realtimepreview.disable' ].length ).toBe( 0 );
	} );

	it( 'T380840', () => {
		cmWe3.switchCodeMirror();
		cmWe3.switchCodeMirror();
		expect( cmWe3.view ).toBeNull();
		mw.hook( 'ext.CodeMirror.ready' ).fire( cmWe3.$textarea, cmWe3 );
	} );

	it( 'only 1 ext.CodeMirror.ready hook handler', () => {
		mediaWikiLang( {
			bidiIsolation: false
		}, {
			tags: {},
			functionSynonyms: [ {}, {} ],
			variableIDs: [],
			doubleUnderscore: [ {}, {} ],
			urlProtocols: 'http://'
		} );
		expect( mw.hook.mockHooks[ 'ext.CodeMirror.ready' ].length ).toBe( 1 );
	} );
} );
