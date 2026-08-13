const CodeMirrorVisualEditorOpenLinks = require( '../../resources/visualEditor/codemirror.visualEditorOpenLinks.js' );

/**
 * Build a mock ve.ui.Surface sufficient for the open-links handler.
 *
 * The attached root is a real element, so listeners are exercised by dispatching events on it.
 * Coordinate and offset mapping is stubbed: getOffsetFromEventCoords returns pageX, and source
 * offsets are the identity, so a test's pageX is the source offset it resolves at.
 *
 * @param {string} [mode]
 * @return {Object}
 */
const getMockSurface = ( mode = 'source' ) => {
	const $attachedRootNode = $( '<div>' ).appendTo( document.body );
	const model = {
		getSourceOffsetFromOffset: jest.fn().mockImplementation( ( offset ) => offset )
	};
	const surfaceView = {
		$attachedRootNode: $attachedRootNode,
		getOffsetFromEventCoords: jest.fn().mockImplementation( ( e ) => e.pageX )
	};
	return {
		getView: jest.fn().mockReturnValue( surfaceView ),
		getModel: jest.fn().mockReturnValue( model ),
		getMode: jest.fn().mockReturnValue( mode ),
		// Exposed for assertions
		model: model,
		view: surfaceView,
		$attachedRootNode: $attachedRootNode
	};
};

let surface, handler, config, rafCallback;

/**
 * Dispatch a mouse event on the attached root, defaulting to a left button with the modifier.
 *
 * @param {string} type
 * @param {Object} [props]
 * @return {MouseEvent}
 */
const dispatch = ( type, props = {} ) => {
	// cancelable, or preventDefault() is a no-op and defaultPrevented never becomes true.
	const e = new MouseEvent( type, Object.assign( {
		bubbles: true, cancelable: true, button: 0, ctrlKey: true
	}, props ) );
	// jsdom's MouseEvent has no pageX, and it is read-only where it does exist.
	Object.defineProperty( e, 'pageX', { value: props.pageX === undefined ? 5 : props.pageX } );
	Object.defineProperty( e, 'pageY', { value: 0 } );
	// The handler listens on the root in the capture phase, so target the root's child.
	surface.$attachedRootNode[ 0 ].appendChild( document.createElement( 'span' ) );
	surface.$attachedRootNode[ 0 ].lastChild.dispatchEvent( e );
	return e;
};

/**
 * Dispatch a modifier keydown or keyup on the document.
 *
 * @param {string} type
 * @param {boolean} held Whether the modifier is down after this event
 */
const dispatchKey = ( type, held ) => {
	document.dispatchEvent(
		new KeyboardEvent( type, { key: 'Control', ctrlKey: held, bubbles: true } )
	);
};

/**
 * Run the callback the mocked requestAnimationFrame captured, if any.
 */
const flushFrame = () => {
	const callback = rafCallback;
	rafCallback = null;
	if ( callback ) {
		callback();
	}
};

beforeEach( () => {
	document.body.innerHTML = '';
	rafCallback = null;
	global.requestAnimationFrame = jest.fn().mockImplementation( ( callback ) => {
		rafCallback = callback;
		return 42;
	} );
	global.cancelAnimationFrame = jest.fn();
	window.open = jest.fn();

	surface = getMockSurface();
	config = {
		// A link occupying source offsets 2 to 9, so pageX 5 is inside it and 20 is not.
		resolveLinkAt: jest.fn().mockImplementation( ( state, pos ) => (
			pos >= 2 && pos <= 9 ? { url: '/wiki/Foo', from: 2, to: 9 } : null
		) ),
		hasModifier: ( e ) => !!e.ctrlKey,
		modKey: 'Control',
		getState: jest.fn().mockReturnValue( { doc: '[[Foo bar]]' } ),
		drawLink: jest.fn().mockReturnValue( true ),
		clearLink: jest.fn()
	};
	handler = new CodeMirrorVisualEditorOpenLinks( surface, config );
} );

describe( 'setEnabled', () => {
	it( 'should be inert until enabled', () => {
		dispatch( 'mousedown' );
		expect( window.open ).not.toHaveBeenCalled();
	} );

	it( 'should refuse to enable outside source mode', () => {
		const visual = new CodeMirrorVisualEditorOpenLinks( getMockSurface( 'visual' ), config );
		visual.setEnabled( true );
		expect( visual.enabled ).toBe( false );
	} );

	it( 'should unbind and clear when disabled', () => {
		handler.setEnabled( true );
		dispatch( 'mousemove' );
		flushFrame();
		expect( config.drawLink ).toHaveBeenCalled();

		handler.setEnabled( false );
		expect( config.clearLink ).toHaveBeenCalled();
		expect( surface.$attachedRootNode[ 0 ].classList.contains( 'cm-mw-ve-openLink' ) ).toBe( false );

		window.open.mockClear();
		dispatch( 'mousedown' );
		expect( window.open ).not.toHaveBeenCalled();
	} );

	it( 'should ignore a repeated toggle to the same state', () => {
		handler.setEnabled( true );
		handler.setEnabled( true );
		expect( handler.enabled ).toBe( true );
		// Bound once, so one open per click.
		dispatch( 'mousedown' );
		expect( window.open ).toHaveBeenCalledTimes( 1 );
	} );
} );

describe( 'opening links', () => {
	beforeEach( () => {
		handler.setEnabled( true );
	} );

	it( 'should open the link under a modifier-click in a new tab', () => {
		const e = dispatch( 'mousedown' );
		expect( window.open ).toHaveBeenCalledWith( '/wiki/Foo', '_blank', 'noopener noreferrer' );
		expect( e.defaultPrevented ).toBe( true );
	} );

	it( 'should leave a click without the modifier to VisualEditor', () => {
		const e = dispatch( 'mousedown', { ctrlKey: false } );
		expect( window.open ).not.toHaveBeenCalled();
		expect( e.defaultPrevented ).toBe( false );
	} );

	it( 'should keep the event from VisualEditor\'s own bubble-phase handler', () => {
		// ve.ce.Surface binds mousedown on the attached root, which is where the cursor is
		// moved from. Reaching it would defeat the point of opening the link.
		const veHandler = jest.fn();
		surface.$attachedRootNode[ 0 ].addEventListener( 'mousedown', veHandler );
		dispatch( 'mousedown' );
		expect( window.open ).toHaveBeenCalled();
		expect( veHandler ).not.toHaveBeenCalled();
	} );

	it( 'should let the event through when it opens nothing', () => {
		const veHandler = jest.fn();
		surface.$attachedRootNode[ 0 ].addEventListener( 'mousedown', veHandler );
		dispatch( 'mousedown', { pageX: 20 } );
		expect( veHandler ).toHaveBeenCalled();
	} );

	it( 'should ignore buttons other than the left one', () => {
		dispatch( 'mousedown', { button: 1 } );
		expect( window.open ).not.toHaveBeenCalled();
	} );

	it( 'should do nothing where there is no link', () => {
		const e = dispatch( 'mousedown', { pageX: 20 } );
		expect( window.open ).not.toHaveBeenCalled();
		expect( e.defaultPrevented ).toBe( false );
	} );

	it( 'should clear the mark once the link is opened', () => {
		dispatch( 'mousemove' );
		flushFrame();
		config.clearLink.mockClear();
		dispatch( 'mousedown' );
		expect( config.clearLink ).toHaveBeenCalled();
		expect( surface.$attachedRootNode[ 0 ].classList.contains( 'cm-mw-ve-openLink' ) ).toBe( false );
	} );
} );

describe( 'marking the link under the pointer', () => {
	beforeEach( () => {
		handler.setEnabled( true );
	} );

	it( 'should mark the link the pointer moves onto with the modifier held', () => {
		dispatch( 'mousemove' );
		flushFrame();
		expect( config.drawLink ).toHaveBeenCalledWith( 2, 9 );
		expect( surface.$attachedRootNode[ 0 ].classList.contains( 'cm-mw-ve-openLink' ) ).toBe( true );
	} );

	it( 'should not mark anything while the modifier is up', () => {
		dispatch( 'mousemove', { ctrlKey: false } );
		expect( requestAnimationFrame ).not.toHaveBeenCalled();
		expect( config.drawLink ).not.toHaveBeenCalled();
	} );

	it( 'should mark the link a stationary pointer already rests on', () => {
		dispatch( 'mousemove', { ctrlKey: false } );
		dispatchKey( 'keydown', true );
		flushFrame();
		expect( config.drawLink ).toHaveBeenCalledWith( 2, 9 );
	} );

	it( 'should unmark on the modifier keyup', () => {
		dispatch( 'mousemove' );
		flushFrame();
		config.clearLink.mockClear();
		dispatchKey( 'keyup', false );
		expect( config.clearLink ).toHaveBeenCalled();
		expect( surface.$attachedRootNode[ 0 ].classList.contains( 'cm-mw-ve-openLink' ) ).toBe( false );
	} );

	it( 'should ignore keys other than the modifier', () => {
		dispatch( 'mousemove', { ctrlKey: false } );
		document.dispatchEvent( new KeyboardEvent( 'keydown', { key: 'a', ctrlKey: true } ) );
		expect( requestAnimationFrame ).not.toHaveBeenCalled();
	} );

	it( 'should forget the pointer when it leaves the surface', () => {
		dispatch( 'mousemove' );
		flushFrame();
		config.clearLink.mockClear();
		dispatch( 'mouseleave' );
		expect( config.clearLink ).toHaveBeenCalled();
		// With no pointer, pressing the modifier resolves nothing.
		config.resolveLinkAt.mockClear();
		dispatchKey( 'keydown', true );
		flushFrame();
		expect( config.resolveLinkAt ).not.toHaveBeenCalled();
	} );

	it( 'should not redraw an unchanged token', () => {
		dispatch( 'mousemove', { pageX: 3 } );
		flushFrame();
		dispatch( 'mousemove', { pageX: 7 } );
		flushFrame();
		expect( config.drawLink ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'should unmark when the pointer moves off the link', () => {
		dispatch( 'mousemove' );
		flushFrame();
		config.clearLink.mockClear();
		dispatch( 'mousemove', { pageX: 20 } );
		flushFrame();
		expect( config.clearLink ).toHaveBeenCalled();
	} );

	it( 'should coalesce moves within one frame', () => {
		dispatch( 'mousemove' );
		dispatch( 'mousemove' );
		expect( requestAnimationFrame ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'should drop the mark when drawing fails', () => {
		config.drawLink.mockReturnValue( false );
		dispatch( 'mousemove' );
		flushFrame();
		expect( handler.drawn ).toBeNull();
		expect( surface.$attachedRootNode[ 0 ].classList.contains( 'cm-mw-ve-openLink' ) ).toBe( false );
	} );

	it( 'should unmark when the window loses focus with the modifier held', () => {
		dispatch( 'mousemove' );
		flushFrame();
		config.clearLink.mockClear();
		window.dispatchEvent( new Event( 'blur' ) );
		expect( config.clearLink ).toHaveBeenCalled();
	} );

	it( 'should unmark when the tab is hidden', () => {
		dispatch( 'mousemove' );
		flushFrame();
		config.clearLink.mockClear();
		document.dispatchEvent( new Event( 'visibilitychange' ) );
		expect( config.clearLink ).toHaveBeenCalled();
	} );

	it( 'should cancel a pending frame when clearing', () => {
		dispatch( 'mousemove' );
		dispatchKey( 'keyup', false );
		expect( cancelAnimationFrame ).toHaveBeenCalledWith( 42 );
	} );
} );

describe( 'resolution guards', () => {
	beforeEach( () => {
		handler.setEnabled( true );
	} );

	it( 'should give up without a tokenizer state', () => {
		config.getState.mockReturnValue( null );
		dispatch( 'mousedown' );
		expect( config.resolveLinkAt ).not.toHaveBeenCalled();
		expect( window.open ).not.toHaveBeenCalled();
	} );

	it( 'should give up on coordinates outside the document', () => {
		surface.view.getOffsetFromEventCoords.mockReturnValue( -1 );
		dispatch( 'mousedown' );
		expect( config.resolveLinkAt ).not.toHaveBeenCalled();
	} );

	it( 'should give up when the source offset is out of bounds', () => {
		surface.model.getSourceOffsetFromOffset.mockImplementation( () => {
			throw new Error( 'Offset out of bounds' );
		} );
		dispatch( 'mousedown' );
		expect( config.resolveLinkAt ).not.toHaveBeenCalled();
		expect( window.open ).not.toHaveBeenCalled();
	} );
} );

describe( 'destroy', () => {
	it( 'should unbind and release the surface', () => {
		handler.setEnabled( true );
		handler.destroy();
		expect( handler.enabled ).toBe( false );
		expect( handler.surface ).toBeNull();
		dispatch( 'mousedown' );
		expect( window.open ).not.toHaveBeenCalled();
	} );
} );
