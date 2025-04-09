const CodeMirrorVisualEditor = require( '../../resources/codemirror.visualEditor.js' );

const getMockSurface = ( readOnly = false ) => ( {
	getView: () => ( {
		$attachedRootNode: $( '<div>' ),
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
	getDom: jest.fn().mockReturnValue( '' )
} );
let cmVe, surface;

beforeEach( () => {
	mw.config.get = jest.fn().mockReturnValue( { defaultPreferences: {} } );
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
