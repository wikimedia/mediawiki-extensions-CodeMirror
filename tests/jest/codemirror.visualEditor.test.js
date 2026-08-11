const CodeMirrorVisualEditor = require( '../../resources/visualEditor/codemirror.visualEditor.js' );

const getMockSurface = ( readOnly = false, targetName = 'article' ) => ( {
	getView: () => ( {
		$attachedRootNode: $( '<div>' ).css( 'padding', '10px' ),
		$documentNode: $( '<div>' ),
		$element: $( '<div>' ),
		getDocument: jest.fn().mockReturnValue( {
			getDir: jest.fn().mockReturnValue( 'ltr' )
		} ),
		focus: jest.fn(),
		isFocused: jest.fn().mockReturnValue( true ),
		on: jest.fn(),
		off: jest.fn()
	} ),
	getModel: () => ( {
		isReadOnly: jest.fn().mockReturnValue( readOnly ),
		getDocument: jest.fn().mockImplementation( () => ( {
			on: jest.fn(),
			off: jest.fn()
		} ) ),
		on: jest.fn(),
		off: jest.fn(),
		getSourceOffsetFromOffset: jest.fn()
	} ),
	getMode: () => 'source',
	getDom: jest.fn().mockReturnValue( '' ),
	getTarget: jest.fn().mockReturnValue( { constructor: { name: targetName } } )
} );
let cmVe, surface;

beforeEach( () => {
	global.ve = { init: { target: { constructor: { name: 'article' } } } };
	mockMwConfigGet();
	surface = getMockSurface();
	cmVe = new CodeMirrorVisualEditor( surface );
} );

afterEach( () => {
	mw.hook.mockHooks = {};
} );

describe( 'constructor', () => {
	it( 'should set the surface with the attached root node as a mimicked textarea', () => {
		cmVe.initialize();
		expect( cmVe.surface ).toStrictEqual( surface );
		expect( cmVe.textarea ).toStrictEqual( surface.getView().$attachedRootNode[ 0 ] );
	} );

	it( 'should go by the VE model for the read-only state', () => {
		surface = getMockSurface( true );
		cmVe = new CodeMirrorVisualEditor( surface );
		expect( cmVe.readOnly ).toStrictEqual( true );
		cmVe.initialize();
		expect( cmVe.view.state.readOnly ).toStrictEqual( true );
	} );
} );

describe( 'initialize', () => {
	it( 'should fire the initialize hook with the ve.ui.Surface object', () => {
		let initArg;
		mw.hook( 'ext.CodeMirror.initialize' ).add( ( ret ) => {
			initArg = ret;
		} );
		cmVe.initialize();
		expect( initArg ).toStrictEqual( surface );
	} );

	it( 'should not use line numbering in DiscussionTools', () => {
		surface = getMockSurface( false, 'CommentTarget' );
		cmVe = new CodeMirrorVisualEditor( surface );
		expect( cmVe.extensionRegistry.lineNumber ).toBeUndefined();
		cmVe.initialize();
		expect( cmVe.extensionRegistry.isEnabled( 'lineNumbering', cmVe.view ) ).toBe( false );
	} );

	it( 'should use the computed padding of the attached root note', () => {
		// Root node has 10px padding in the mock.
		cmVe.initialize();
		expect( global.getComputedStyle( cmVe.view.dom ).padding ).toBe( '10px' );
	} );

	it( 'should maintain the focus state of the VE surface (focused)', () => {
		cmVe.surfaceView.focus();
		const spy = jest.spyOn( cmVe.surfaceView, 'focus' );
		cmVe.initialize();
		expect( spy ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'should maintain the focus state of the VE surface (not focused)', () => {
		document.activeElement.blur();
		const spy = jest.spyOn( cmVe.surfaceView, 'focus' );
		cmVe.initialize();
		expect( spy ).not.toHaveBeenCalled();
	} );
} );

describe( 'activate', () => {
	it( 'should force an infinite viewport', () => {
		cmVe.initialize();
		expect( cmVe.view.viewState.printing ).toStrictEqual( true );
	} );

	it( 'should sync the directionality', () => {
		const spy = jest.spyOn( cmVe, 'onPosition' );
		cmVe.initialize();
		expect( spy ).toHaveBeenCalledTimes( 1 );
		// Suppress warning about re-activating.
		jest.spyOn( console, 'warn' ).mockImplementation( () => {} );
		cmVe.activate();
		jest.restoreAllMocks();
		// Something with the automocking prevents us from testing against cmVe.view.textDirection,
		// but asserting that onPosition is called is sufficient.
		expect( spy ).toHaveBeenCalledTimes( 2 );
	} );
} );

describe( 'deactivate', () => {
	it( 'should remove the documentNode-codeEditor classes', () => {
		cmVe.initialize();
		expect( cmVe.surfaceView.$documentNode[ 0 ].classList )
			.toContain( 've-ce-documentNode-codeEditor-hide' );
		cmVe.deactivate();
		expect( cmVe.surfaceView.$documentNode[ 0 ].classList )
			.not.toContain( 've-ce-documentNode-codeEditor-hide' );
	} );
} );

describe( 'updateGutterWidth', () => {
	it( 'should clear the offsets when there is no gutter', () => {
		cmVe.initialize();
		// The state a removed gutter leaves behind.
		cmVe.surfaceView.$documentNode.css( { 'margin-left': '30px' } );
		cmVe.view.contentDOM.style.width = 'calc(100% - 30px)';
		jest.spyOn( cmVe.view.dom, 'querySelector' ).mockReturnValue( null );
		cmVe.updateGutterWidth( 'ltr' );
		jest.restoreAllMocks();
		expect( cmVe.surfaceView.$documentNode[ 0 ].style.marginLeft ).toBe( '0px' );
		expect( cmVe.view.contentDOM.style.width ).toBe( '' );
	} );
} );

describe( 'applyPreference', () => {
	it( 'should re-measure the gutter when line numbering is toggled', () => {
		cmVe.initialize();
		const spy = jest.spyOn( cmVe, 'updateGutterWidth' );
		cmVe.applyPreference( 'lineNumbering', false );
		expect( spy ).toHaveBeenCalledWith( 'ltr' );
	} );

	it( 'should not re-measure it for other preferences', () => {
		cmVe.initialize();
		const spy = jest.spyOn( cmVe, 'updateGutterWidth' );
		cmVe.applyPreference( 'bracketMatching', false );
		expect( spy ).not.toHaveBeenCalled();
	} );
} );

describe( 'onSelect', () => {
	/**
	 * @param {number} from
	 * @param {number} to
	 * @return {Object} A ve.dm selection exposing the given covering range
	 */
	const selectionOf = ( from, to ) => ( {
		getCoveringRange: () => ( { from, to, isCollapsed: () => from === to } )
	} );

	beforeEach( () => {
		surface = getMockSurface();
		surface.getDom = jest.fn().mockReturnValue( 'one\ntwo\nthree' );
		// Identity offset mapping, so DM offsets and source offsets are interchangeable.
		const model = surface.getModel();
		model.getSourceOffsetFromOffset = jest.fn().mockImplementation( ( offset ) => offset );
		surface.getModel = () => model;
		cmVe = new CodeMirrorVisualEditor( surface );
		cmVe.initialize();
	} );

	it( 'should mirror a collapsed cursor', () => {
		cmVe.onSelect( selectionOf( 5, 5 ) );
		expect( cmVe.view.state.selection.main.anchor ).toBe( 5 );
		expect( cmVe.view.state.selection.main.head ).toBe( 5 );
	} );

	it( 'should mirror a whole selection, so the head lands on the focused line', () => {
		cmVe.onSelect( selectionOf( 1, 9 ) );
		expect( cmVe.view.state.selection.main.anchor ).toBe( 1 );
		expect( cmVe.view.state.selection.main.head ).toBe( 9 );
	} );

	it( 'should keep the head at the focus end of a backwards selection', () => {
		cmVe.onSelect( selectionOf( 9, 1 ) );
		expect( cmVe.view.state.selection.main.head ).toBe( 1 );
	} );

	it( 'should clamp offsets beyond the document (T382769)', () => {
		const docLength = cmVe.view.state.doc.length;
		cmVe.onSelect( selectionOf( 0, docLength + 50 ) );
		expect( cmVe.view.state.selection.main.head ).toBe( docLength );
	} );
} );

describe( 'logEditFeature', () => {
	it( 'should only log the \'activated\' action', () => {
		const spy = jest.spyOn( mw, 'track' );
		cmVe.initialize();
		expect( spy ).toHaveBeenCalledTimes( 1 );
		expect( spy ).toHaveBeenNthCalledWith( 1, 'visualEditorFeatureUse', {
			action: 'activated',
			feature: 'codemirror'
		} );
		expect( mw.hook.mockHooks[ 'ext.CodeMirror.search' ] ).toBeUndefined();
		expect( mw.hook.mockHooks[ 'ext.CodeMirror.keymap' ] ).toBeUndefined();
	} );
} );
