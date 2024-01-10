mw.loader = { getState: jest.fn() };

const CodeMirrorWikiEditor = require( '../../src/codemirror.wikieditor.js' ).default,
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

describe( 'enableCodeMirror', () => {
	cmWe.$textarea.wikiEditor = jest.fn();

	it( 'should use the height of the textarea if Realtime Preview disabled', () => {
		mw.loader.getState.mockImplementation( ( module ) => {
			if ( module === 'ext.wikiEditor' ) {
				return 'ready';
			}
			if ( module === 'ext.wikiEditor.realtimepreview' ) {
				return null;
			}
		} );
		$textarea.css( 'height', '999px' );
		cmWe.initialize();
		// Height includes padding and border.
		expect( $( cmWe.view.dom ).css( 'height' ) ).toStrictEqual( '1005px' );
	} );

	it( 'should use 100% height if Realtime Preview is enabled', () => {
		mw.loader.getState.mockImplementation( ( module ) => {
			if ( module === 'ext.wikiEditor' ) {
				return 'ready';
			}
			if ( module === 'ext.wikiEditor.realtimepreview' ) {
				return 'ready';
			}
		} );
		$textarea.css( 'height', '999px' );
		cmWe.initialize();
		expect( $( cmWe.view.dom ).css( 'height' ) ).toStrictEqual( '100%' );
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
