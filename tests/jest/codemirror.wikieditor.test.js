mw.loader = { getState: jest.fn() };

const CodeMirrorWikiEditor = require( '../../resources/codemirror.wikieditor.js' ),
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
