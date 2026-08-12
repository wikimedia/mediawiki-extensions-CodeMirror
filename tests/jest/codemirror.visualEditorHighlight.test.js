const CodeMirrorVisualEditorHighlight = require( '../../resources/visualEditor/codemirror.visualEditorHighlight.js' );
const { mediawiki, matchTag } = require( '../../resources/modes/mediawiki/codemirror.mediawiki.js' );
const CodeMirrorVisualEditor = require( '../../resources/visualEditor/codemirror.visualEditor.js' );
/* eslint-disable-next-line n/no-missing-require */
const { CodeMirrorPreferences, CodeMirrorThemes } = require( 'ext.CodeMirror' );
/* eslint-disable-next-line n/no-missing-require */
const { EditorState } = require( 'ext.CodeMirror.lib' );

/**
 * Build a mock ve.ui.Surface sufficient for the custom-highlight controller.
 *
 * Source-offset mapping is stubbed as the identity function, so DM offsets and
 * source offsets are interchangeable in these tests. getRangeFromSourceOffsets
 * returns a plain marker object; the SelectionManager is fully mocked.
 *
 * @param {string} doc Source wikitext the headless tokenizer is built from
 * @return {Object}
 */
const getMockSurface = ( doc = '' ) => {
	const documentModel = {
		on: jest.fn(),
		off: jest.fn(),
		getStore: jest.fn().mockReturnValue( {} )
	};
	const model = {
		getDocument: jest.fn().mockReturnValue( documentModel ),
		getSourceOffsetFromOffset: jest.fn().mockImplementation( ( offset ) => offset ),
		getRangeFromSourceOffsets: jest.fn().mockImplementation( ( from, to ) => ( { from, to } ) ),
		getLinearFragment: jest.fn().mockImplementation( ( range ) => ( {
			getSelection: jest.fn().mockReturnValue( { range } )
		} ) ),
		// No cursor by default; setCursor() below installs one.
		getSelection: jest.fn().mockReturnValue( null ),
		on: jest.fn(),
		off: jest.fn()
	};
	const selectionManager = {
		drawSelections: jest.fn()
	};
	// One <p> per source line (matching ve.dm.SourceConverter), each a single text node, so
	// getHighlightRange can resolve a token to its line's text node.
	const lineNodes = doc.split( '\n' ).map( ( text ) => ( { $element: $( '<p>' ).text( text ) } ) );
	// Parented, because the gutter inserts itself before the document node.
	const documentNode = { children: lineNodes, $element: $( '<div>' ).appendTo( $( '<div>' ) ) };
	const ceDocument = {
		getDocumentNode: jest.fn().mockReturnValue( documentNode ),
		getDir: jest.fn().mockReturnValue( 'ltr' ),
		// Identity offsets and one paragraph per line, so walk the lines to find the offset.
		getBranchNodeFromOffset: jest.fn().mockImplementation( ( offset ) => {
			let start = 0;
			for ( const node of lineNodes ) {
				const length = node.$element.text().length;
				if ( offset <= start + length ) {
					return node;
				}
				start += length + 1;
			}
			return lineNodes[ lineNodes.length - 1 ];
		} )
	};
	const surfaceView = {
		// The controller scopes the colorblind theme by adding a class here.
		$element: $( '<div>' ),
		// The open-links handler binds to this and marks it while a link is under the pointer,
		// and the inherited initialize() goes by it to restore focus.
		$attachedRootNode: $( '<div>' ),
		getOffsetFromEventCoords: jest.fn().mockImplementation( ( e ) => e.pageX ),
		on: jest.fn(),
		off: jest.fn(),
		// The gutter uses VE's own connect/disconnect for the 'position' event.
		connect: jest.fn(),
		disconnect: jest.fn(),
		getViewportRange: jest.fn().mockReturnValue( { start: 0, end: doc.length } ),
		getSelection: jest.fn().mockImplementation( ( selection ) => selection ),
		getSelectionManager: jest.fn().mockReturnValue( selectionManager ),
		getDocument: jest.fn().mockReturnValue( ceDocument )
	};
	// A non-DiscussionTools target by default; setTarget() below swaps in a CommentTarget.
	let target = { constructor: { name: 'ArticleTarget' } };
	// The modal window manager, which the controller watches so it can suspend the highlights
	// while a window covers the surface.
	const dialogs = {
		connect: jest.fn(),
		disconnect: jest.fn(),
		getCurrentWindow: jest.fn().mockReturnValue( null )
	};
	const mockSurface = {
		getView: jest.fn().mockReturnValue( surfaceView ),
		getModel: jest.fn().mockReturnValue( model ),
		getMode: jest.fn().mockReturnValue( 'source' ),
		getDom: jest.fn().mockReturnValue( doc ),
		getTarget: jest.fn().mockImplementation( () => target ),
		$scrollContainer: { on: jest.fn(), off: jest.fn() },
		$scrollListener: { on: jest.fn(), off: jest.fn() },
		getDialogs: jest.fn().mockReturnValue( dialogs ),
		// Exposed for assertions
		dialogs: dialogs,
		model: model,
		documentModel: documentModel,
		view: surfaceView,
		lineNodes: lineNodes,
		documentNode: documentNode,
		selectionManager: selectionManager,
		// Install a collapsed (or ranged) cursor for bracket-matching tests.
		setCursor: ( start, collapsed = true, to = start ) => {
			model.getSelection.mockReturnValue( {
				getCoveringRange: () => ( {
					start, to, end: Math.max( start, to ), isCollapsed: () => collapsed
				} )
			} );
		},
		// Swap in a DiscussionTools (CommentTarget) target.
		setTarget: ( name ) => {
			target = { constructor: { name } };
		}
	};
	// The gutter reaches the ve.ui.Surface back through the view, for the mode and scroller.
	surfaceView.getSurface = jest.fn().mockReturnValue( mockSurface );
	return mockSurface;
};

let controller, surface, langSupport;

/**
 * Build a controller whose stored `theme` preference is the given value.
 *
 * @param {string} theme One of 'default', 'colorblind', 'no-highlight'
 * @param {string} [doc] Source wikitext
 * @return {Object}
 */
const newThemedController = ( theme, doc = '{{Foo}}' ) => {
	const origGet = mw.user.options.get;
	mw.user.options.get = jest.fn().mockImplementation( ( key ) => (
		key === 'codemirror-preferences' ? JSON.stringify( { theme } ) : null
	) );
	try {
		return new CodeMirrorVisualEditorHighlight( getMockSurface( doc ), langSupport );
	} finally {
		mw.user.options.get = origGet;
	}
};

beforeEach( () => {
	global.ve = {
		// Minimal ve.Range: refresh() builds one per token from the mapped surface offsets.
		Range: function ( from, to ) {
			this.from = from;
			this.to = to === undefined ? from : to;
			this.start = Math.min( this.from, this.to );
			this.end = Math.max( this.from, this.to );
		},
		dm: {
			// Source mode: op.insert is an array of characters; getSourceText joins them.
			ElementLinearData: jest.fn().mockImplementation( ( store, insert ) => ( {
				getSourceText: () => ( Array.isArray( insert ) ? insert.join( '' ) : String( insert ) )
			} ) )
		},
		// The action owns the ::highlight() stylesheet; activate/deactivate park it.
		ui: {
			CodeMirrorAction: {
				static: { setHighlightStylesEnabled: jest.fn() }
			}
		},
		// Synchronous stand-in for the gutter's debounced repaint, so tests need no timers.
		// Keeps the guard, which is the part behaviour depends on.
		debounceWithTest: ( test, func ) => ( ...args ) => {
			if ( test( ...args ) ) {
				return func( ...args );
			}
		}
	};
	// The CSS Custom Highlight API registry (absent from the shared jsdom setup).
	global.CSS.highlights = new Map();
	// Deterministic rAF: capture the callback instead of running it asynchronously.
	global.requestAnimationFrame = jest.fn().mockReturnValue( 42 );
	global.cancelAnimationFrame = jest.fn();

	langSupport = mediawiki( {
		bidiIsolation: false,
		codeFolding: false,
		autocomplete: false,
		openLinks: false
	} );
	surface = getMockSurface( '{{Foo}} [[Bar]]' );
	controller = new CodeMirrorVisualEditorHighlight( surface, langSupport );
} );

describe( 'initialize', () => {
	it( 'should activate when the surface is in source mode', () => {
		const spy = jest.spyOn( controller, 'activate' );
		controller.initialize();
		expect( spy ).toHaveBeenCalledTimes( 1 );
		expect( controller.isActive ).toBe( true );
	} );

	it( 'should warn and not activate in a non-source mode', () => {
		const warnSpy = jest.spyOn( console, 'warn' ).mockImplementation( () => {} );
		surface.getMode.mockReturnValue( 'visual' );
		controller.initialize();
		expect( mw.log.warn ).toHaveBeenCalled();
		expect( controller.isActive ).toBe( false );
		warnSpy.mockRestore();
	} );
} );

describe( 'activate', () => {
	it( 'should build a headless tokenizer and bind listeners on the scroll listener', () => {
		controller.activate();
		expect( controller.isActive ).toBe( true );
		expect( controller.tokenizer.doc.length ).toBe( '{{Foo}} [[Bar]]'.length );
		// Regression (T432558 scroll fix): bind to $scrollListener, never $scrollContainer.
		expect( surface.$scrollListener.on )
			.toHaveBeenCalledWith( 'scroll.codeMirrorVeHighlight', expect.any( Function ) );
		expect( surface.$scrollContainer.on ).not.toHaveBeenCalled();
		expect( surface.documentModel.on ).toHaveBeenCalledWith( 'precommit', expect.any( Function ) );
		expect( surface.view.on ).toHaveBeenCalledWith( 'position', expect.any( Function ) );
		expect( mw.track ).toHaveBeenCalledWith( 'visualEditorFeatureUse', {
			feature: 'codemirror',
			action: 'activated'
		} );
	} );

	it( 'should be a no-op when already active', () => {
		controller.activate();
		surface.documentModel.on.mockClear();
		controller.activate();
		expect( surface.documentModel.on ).not.toHaveBeenCalled();
	} );

	it( 'should warn and not activate when the Highlight API is unsupported', () => {
		const warnSpy = jest.spyOn( console, 'warn' ).mockImplementation( () => {} );
		delete global.CSS.highlights;
		controller.initialize();
		expect( mw.log.warn ).toHaveBeenCalled();
		warnSpy.mockRestore();
	} );
} );

describe( 'deactivate', () => {
	it( 'should unbind listeners and clear highlights', () => {
		controller.activate();
		controller.drawnGroups.add( 'syntax-cm-mw-template-name' );
		controller.deactivate();
		expect( surface.documentModel.off ).toHaveBeenCalledWith( 'precommit', expect.any( Function ) );
		expect( surface.view.off ).toHaveBeenCalledWith( 'position', expect.any( Function ) );
		expect( surface.$scrollListener.off )
			.toHaveBeenCalledWith( 'scroll.codeMirrorVeHighlight', expect.any( Function ) );
		expect( surface.selectionManager.drawSelections )
			.toHaveBeenCalledWith( 'syntax-cm-mw-template-name', [] );
		expect( controller.drawnGroups.size ).toBe( 0 );
		expect( controller.isActive ).toBe( false );
	} );

	it( 'should keep the tokenizer, and re-sync it on re-activation', () => {
		controller.initialize();
		expect( controller.tokenizer ).not.toBeNull();
		controller.deactivate();
		// Kept, so that toggle() knows this is not a first activation.
		expect( controller.tokenizer ).not.toBeNull();

		surface.getDom.mockReturnValue( '{{Bar}}' );
		controller.toggle( true );
		expect( controller.isActive ).toBe( true );
		expect( controller.state.doc.toString() ).toBe( '{{Bar}}' );
	} );

	it( 'should be a no-op when not active', () => {
		controller.deactivate();
		expect( surface.documentModel.off ).not.toHaveBeenCalled();
		// Shouldn't error out.
		controller.extensionRegistry.register( 'lineNumbering', EditorState.tabSize.of( 5 ), controller );
	} );
} );

describe( 'destroy', () => {
	it( 'should deactivate the controller', () => {
		controller.activate();
		controller.destroy();
		expect( controller.isActive ).toBe( false );
		expect( controller.tokenizer ).toBeNull();
	} );

	it( 'should go through the inherited teardown', () => {
		const themesSpy = jest.spyOn( controller.themes, 'destroy' );
		const gutterSpy = jest.spyOn( controller.lineNumberGutter, 'destroy' );
		let destroyArg;
		mw.hook( 'ext.CodeMirror.destroy' ).add( ( arg ) => {
			destroyArg = arg;
		} );

		controller.activate();
		controller.destroy();

		expect( themesSpy ).toHaveBeenCalled();
		expect( gutterSpy ).toHaveBeenCalled();
		// Fired for every integration, this one included.
		expect( destroyArg ).toBe( surface );
	} );

	it( 'should leave the surface alone, having wrapped nothing', () => {
		const $root = controller.surfaceView.$attachedRootNode;
		const parent = $root.parent()[ 0 ];
		controller.activate();
		controller.destroy();
		expect( controller.surfaceView.$attachedRootNode.parent()[ 0 ] ).toBe( parent );
	} );
} );

describe( 'bracket matching', () => {
	const bracketCalls = () => surface.selectionManager.drawSelections.mock.calls
		.filter( ( call ) => /bracket/.test( call[ 0 ] ) );

	it( 'should default to enabled and bind the select listener on activate', () => {
		controller.activate();
		expect( controller.extensionRegistry.isEnabled( 'bracketMatching', controller ) )
			.toBe( true );
		expect( surface.model.on ).toHaveBeenCalledWith( 'select', expect.any( Function ) );
	} );

	it( 'should stay disabled and not bind select when the user preference is off', () => {
		const origGet = mw.user.options.get;
		mw.user.options.get = jest.fn().mockReturnValue( '{"bracketMatching":false}' );
		try {
			const disabled = new CodeMirrorVisualEditorHighlight( getMockSurface( '{{Foo}}' ), langSupport );
			disabled.activate();
			expect( disabled.extensionRegistry.isEnabled( 'bracketMatching', disabled ) )
				.toBe( false );
			const boundSelect = disabled.surface.getModel().on.mock.calls
				.some( ( call ) => call[ 0 ] === 'select' );
			expect( boundSelect ).toBe( false );
		} finally {
			mw.user.options.get = origGet;
		}
	} );

	it( 'should highlight the bracket pair at a collapsed cursor', () => {
		controller.activate();
		surface.selectionManager.drawSelections.mockClear();
		// Cursor just inside the opening braces of "{{Foo}}".
		surface.setCursor( 2 );
		controller.updateBracketMatch();
		const calls = bracketCalls();
		expect( calls.length ).toBe( 1 );
		expect( calls[ 0 ][ 0 ] ).toBe( 'matching-bracket' );
		expect( calls[ 0 ][ 2 ] ).toEqual( { showRects: false, showCustomHighlight: true } );
		expect( controller.bracketGroups.has( 'matching-bracket' ) ).toBe( true );
	} );

	it( 'should clear the match when the cursor is not near a bracket', () => {
		surface = getMockSurface( 'plain text here' );
		controller = new CodeMirrorVisualEditorHighlight( surface, langSupport );
		controller.activate();
		surface.setCursor( 5 );
		controller.updateBracketMatch();
		expect( bracketCalls().length ).toBe( 0 );
		expect( controller.bracketGroups.size ).toBe( 0 );
	} );

	it( 'should not match on a non-collapsed selection', () => {
		controller.activate();
		surface.selectionManager.drawSelections.mockClear();
		surface.setCursor( 2, false );
		controller.updateBracketMatch();
		expect( bracketCalls().length ).toBe( 0 );
	} );

	it( 'should keep bracket groups separate from syntax groups across a refresh', () => {
		controller.activate();
		surface.setCursor( 2 );
		controller.updateBracketMatch();
		const drawn = new Set( controller.bracketGroups );
		expect( drawn.size ).toBeGreaterThan( 0 );
		controller.refresh();
		expect( controller.bracketGroups ).toEqual( drawn );
	} );

	it( 'should unbind select and clear bracket groups on deactivate', () => {
		controller.activate();
		surface.setCursor( 2 );
		controller.updateBracketMatch();
		expect( controller.bracketGroups.size ).toBeGreaterThan( 0 );
		controller.deactivate();
		expect( surface.model.off ).toHaveBeenCalledWith( 'select', expect.any( Function ) );
		expect( controller.bracketGroups.size ).toBe( 0 );
	} );

	it( 'should clear the match when the preference is turned off', () => {
		controller.activate();
		surface.setCursor( 2 );
		controller.updateBracketMatch();
		expect( controller.bracketGroups.size ).toBeGreaterThan( 0 );

		controller.applyPreference( 'bracketMatching', false );

		expect( controller.extensionRegistry.isEnabled( 'bracketMatching', controller ) )
			.toBe( false );
		expect( surface.model.off ).toHaveBeenCalledWith( 'select', expect.any( Function ) );
		expect( controller.bracketGroups.size ).toBe( 0 );
	} );
} );

describe( 'highlightRefs', () => {
	const hasRefsClass = ( cm ) => cm.surfaceView.$element[ 0 ].classList
		.contains( 'cm-mw-highlight-refs' );

	/**
	 * @return {Object} Controller with the highlightRefs preference off
	 */
	const newUnrefsController = () => {
		const origGet = mw.user.options.get;
		mw.user.options.get = jest.fn().mockImplementation( ( key ) => (
			key === 'codemirror-preferences' ?
				JSON.stringify( { highlightRefs: false } ) :
				null
		) );
		try {
			return new CodeMirrorVisualEditorHighlight(
				getMockSurface( '<ref>Foo</ref>' ), langSupport
			);
		} finally {
			mw.user.options.get = origGet;
		}
	};

	it( 'should scope the surface when the preference is on, as it is by default', () => {
		controller.activate();
		expect( hasRefsClass( controller ) ).toBe( true );
	} );

	it( 'should not scope the surface when the preference is off', () => {
		const unrefs = newUnrefsController();
		unrefs.activate();
		expect( hasRefsClass( unrefs ) ).toBe( false );
	} );

	it( 'should unscope and scope again as the preference is toggled', () => {
		controller.activate();
		controller.applyPreference( 'highlightRefs', false );
		expect( controller.extensionRegistry.isEnabled( 'highlightRefs', controller ) )
			.toBe( false );
		expect( hasRefsClass( controller ) ).toBe( false );

		controller.applyPreference( 'highlightRefs', true );
		expect( hasRefsClass( controller ) ).toBe( true );
	} );

	it( 'should unscope the surface on deactivate', () => {
		controller.activate();
		controller.deactivate();
		expect( hasRefsClass( controller ) ).toBe( false );
	} );
} );

describe( 'tag matching', () => {
	// The controller reuses the bracket groups for tags, so filter the same way.
	const bracketCalls = ( s ) => s.selectionManager.drawSelections.mock.calls
		.filter( ( call ) => /bracket/.test( call[ 0 ] ) );

	it( 'should re-export the headless matchTag from the mediawiki mode', () => {
		expect( typeof matchTag ).toBe( 'function' );
	} );

	it( 'should highlight a matched tag pair when the cursor is not on a bracket', () => {
		// A bracket-free document, so findBracketMatch returns null and the tag matcher runs.
		const mock = jest.fn().mockReturnValue( {
			matched: true, start: { from: 0, to: 5 }, end: { from: 8, to: 14 }
		} );
		const s = getMockSurface( 'ref content' );
		const c = new CodeMirrorVisualEditorHighlight( s, langSupport, mock );
		c.activate();
		s.selectionManager.drawSelections.mockClear();
		s.setCursor( 2 );
		c.updateBracketMatch();
		expect( mock ).toHaveBeenCalled();
		const calls = bracketCalls( s );
		expect( calls.length ).toBe( 1 );
		expect( calls[ 0 ][ 0 ] ).toBe( 'matching-bracket' );
		expect( calls[ 0 ][ 1 ].length ).toBe( 2 );
		expect( c.bracketGroups.has( 'matching-bracket' ) ).toBe( true );
	} );

	it( 'should paint a self-closing tag as a single matching selection', () => {
		const mock = jest.fn().mockReturnValue( { matched: true, start: { from: 0, to: 3 } } );
		const s = getMockSurface( 'ref content' );
		const c = new CodeMirrorVisualEditorHighlight( s, langSupport, mock );
		c.activate();
		s.selectionManager.drawSelections.mockClear();
		s.setCursor( 2 );
		c.updateBracketMatch();
		const calls = bracketCalls( s );
		expect( calls.length ).toBe( 1 );
		expect( calls[ 0 ][ 0 ] ).toBe( 'matching-bracket' );
		expect( calls[ 0 ][ 1 ].length ).toBe( 1 );
	} );

	it( 'should paint an unmatched open tag as a nonmatching selection', () => {
		const mock = jest.fn().mockReturnValue( { matched: false, start: { from: 0, to: 5 } } );
		const s = getMockSurface( 'ref content' );
		const c = new CodeMirrorVisualEditorHighlight( s, langSupport, mock );
		c.activate();
		s.selectionManager.drawSelections.mockClear();
		s.setCursor( 2 );
		c.updateBracketMatch();
		const calls = bracketCalls( s );
		expect( calls.length ).toBe( 1 );
		expect( calls[ 0 ][ 0 ] ).toBe( 'nonmatching-bracket' );
		expect( calls[ 0 ][ 1 ].length ).toBe( 1 );
	} );

	it( 'should paint bracket and tag matches independently', () => {
		// A real bracket at the cursor plus a (mock) unmatched tag: both run and draw into their
		// respective groups. A surrounding bracket no longer suppresses tag matching, so a tag
		// nested inside brackets is still highlighted.
		const mock = jest.fn().mockReturnValue( { matched: false, start: { from: 0, to: 5 } } );
		const s = getMockSurface( '{{Foo}}' );
		const c = new CodeMirrorVisualEditorHighlight( s, langSupport, mock );
		c.activate();
		s.selectionManager.drawSelections.mockClear();
		s.setCursor( 2 );
		c.updateBracketMatch();
		expect( mock ).toHaveBeenCalled();
		const groups = s.selectionManager.drawSelections.mock.calls
			.filter( ( call ) => /bracket/.test( call[ 0 ] ) )
			.map( ( call ) => call[ 0 ] );
		expect( groups ).toContain( 'matching-bracket' );
		expect( groups ).toContain( 'nonmatching-bracket' );
	} );
} );

describe( 'line numbering', () => {
	it( 'should default to enabled from the lineNumbering preference', () => {
		controller.activate();
		expect( controller.extensionRegistry.isEnabled( 'lineNumbering', controller ) )
			.toBe( true );
	} );

	it( 'should enable the gutter on activate, with the controller\'s formatter', () => {
		expect( controller.lineNumberGutter.formatNumber ).toEqual( expect.any( Function ) );
		controller.activate();
		expect( controller.lineNumberGutter.enabled ).toBe( true );
	} );

	it( 'should disable the gutter on deactivate', () => {
		controller.activate();
		controller.deactivate();
		expect( controller.lineNumberGutter.enabled ).toBe( false );
	} );

	it( 'should attach the gutter beside the document node while enabled', () => {
		controller.activate();
		expect( surface.documentNode.$element.prev()[ 0 ] )
			.toBe( controller.lineNumberGutter.$element[ 0 ] );
		controller.deactivate();
		expect( surface.documentNode.$element.prev().length ).toBe( 0 );
	} );

	it( 'should pass the preference through when line numbering is disabled', () => {
		const origGet = mw.user.options.get;
		mw.user.options.get = jest.fn().mockReturnValue( '{"lineNumbering":false}' );
		try {
			const disabled = new CodeMirrorVisualEditorHighlight( getMockSurface( 'x' ), langSupport );
			disabled.activate();
			expect( disabled.extensionRegistry.isEnabled( 'lineNumbering', disabled ) )
				.toBe( false );
			expect( disabled.lineNumberGutter.enabled ).toBe( false );
		} finally {
			mw.user.options.get = origGet;
		}
	} );

	it( 'should stay disabled in the DiscussionTools integration', () => {
		const dtSurface = getMockSurface( 'x' );
		dtSurface.setTarget( 'CommentTarget' );
		const dt = new CodeMirrorVisualEditorHighlight( dtSurface, langSupport );
		dt.activate();
		// Left out of the registry entirely there, so it can never report as enabled.
		expect( dt.extensionRegistry.isEnabled( 'lineNumbering', dt ) ).toBe( false );
		expect( dt.lineNumberGutter.enabled ).toBe( false );
	} );

	it( 'should show and hide the gutter as the preference is toggled', () => {
		controller.activate();
		expect( controller.lineNumberGutter.enabled ).toBe( true );

		controller.applyPreference( 'lineNumbering', false );
		expect( controller.extensionRegistry.isEnabled( 'lineNumbering', controller ) )
			.toBe( false );
		expect( controller.lineNumberGutter.enabled ).toBe( false );

		controller.applyPreference( 'lineNumbering', true );
		expect( controller.lineNumberGutter.enabled ).toBe( true );
	} );

	it( 'should stay independent of the no-highlight theme', () => {
		// Bracket-match and line-number styles live outside the theme-scoped rules in
		// codemirror.mediawiki.less, so 'no-highlight' must not switch them off here either.
		const themed = newThemedController( 'no-highlight' );
		themed.activate();
		expect( themed.lineNumberGutter.enabled ).toBe( true );
		expect( themed.surface.getModel().on )
			.toHaveBeenCalledWith( 'select', expect.any( Function ) );
	} );

	it( 'should refuse to enable outside source mode', () => {
		surface.getMode.mockReturnValue( 'visual' );
		controller.lineNumberGutter.setEnabled( true );
		expect( controller.lineNumberGutter.enabled ).toBe( false );
	} );

	it( 'should follow a direction change onto the other edge', () => {
		controller.activate();
		const gutter = controller.lineNumberGutter,
			$documentNode = surface.documentNode.$element;
		expect( gutter.side ).toBe( 'left' );
		expect( $documentNode[ 0 ].style.paddingLeft ).not.toBe( '' );

		surface.getView().getDocument().getDir.mockReturnValue( 'rtl' );
		gutter.update();

		expect( gutter.side ).toBe( 'right' );
		expect( $documentNode[ 0 ].style.paddingRight ).not.toBe( '' );
		// The edge it used to reserve is released, or the text stays indented on both sides.
		expect( $documentNode[ 0 ].style.paddingLeft ).toBe( '' );
		expect( gutter.$element[ 0 ].style.left ).toBe( '' );
		expect( gutter.$element[ 0 ].style.right ).not.toBe( '' );
	} );

	it( 'should tear the gutter down on destroy', () => {
		controller.activate();
		controller.destroy();
		expect( controller.lineNumberGutter.surfaceView ).toBeNull();
	} );

	it( 'should localise the number with the digit transform when enabled', () => {
		const origTable = mw.language.getDigitTransformTable,
			origConfigGet = mw.config.get;
		mw.language.getDigitTransformTable = jest.fn().mockReturnValue( { 1: '١', 2: '٢', 3: '٣' } );
		mw.config.get = jest.fn().mockImplementation( ( key ) => key === 'wgTranslateNumerals' );
		try {
			expect( controller.formatLineNumber( 123 ) ).toBe( '١٢٣' );
		} finally {
			mw.language.getDigitTransformTable = origTable;
			mw.config.get = origConfigGet;
		}
	} );

	it( 'should return plain digits when digit translation is off', () => {
		expect( controller.formatLineNumber( 42 ) ).toBe( '42' );
	} );
} );

describe( 'themes', () => {
	it( 'should default to the default theme, with highlighting on', () => {
		expect( controller.theme ).toBe( 'default' );
		expect( controller.syntaxHighlightingEnabled ).toBe( true );
		controller.activate();
		expect( surface.view.$element[ 0 ].classList.contains( 'cm-mw-colorblind-colors' ) )
			.toBe( false );
	} );

	it( 'should not paint syntax colors under the no-highlight theme (T419339)', () => {
		const themed = newThemedController( 'no-highlight', '{{Foo}} [[Bar]]' );
		themed.activate();
		expect( themed.syntaxHighlightingEnabled ).toBe( false );
		// The refresh listeners are never bound. Named specifically: the gutter binds its own
		// scroll listener on the same object, under a different namespace.
		expect( themed.surface.$scrollListener.on )
			.not.toHaveBeenCalledWith( 'scroll.codeMirrorVeHighlight', expect.any( Function ) );
		expect( themed.surface.getView().on )
			.not.toHaveBeenCalledWith( 'position', expect.any( Function ) );
		// ...and an explicit refresh draws nothing.
		themed.refresh();
		expect( themed.surface.getView().getSelectionManager().drawSelections )
			.not.toHaveBeenCalled();
	} );

	it( 'should still keep the tokenizer in sync under no-highlight', () => {
		// Bracket matching parses from the same tokenizer, so it must survive the theme.
		const themed = newThemedController( 'no-highlight' );
		themed.activate();
		expect( themed.tokenizer ).not.toBeNull();
		expect( themed.surface.getModel().getDocument().on )
			.toHaveBeenCalledWith( 'precommit', expect.any( Function ) );
	} );

	it( 'should scope the colorblind theme with a class on the VE surface', () => {
		const themed = newThemedController( 'colorblind' );
		const $element = themed.surface.getView().$element;
		expect( themed.syntaxHighlightingEnabled ).toBe( true );
		themed.activate();
		expect( $element[ 0 ].classList.contains( 'cm-mw-colorblind-colors' ) ).toBe( true );
		themed.deactivate();
		expect( $element[ 0 ].classList.contains( 'cm-mw-colorblind-colors' ) ).toBe( false );
	} );

	it( 'should repaint when the theme is changed through the registry', () => {
		const isColorblind = () => controller.surfaceView.$element[ 0 ].classList
			.contains( 'cm-mw-colorblind-colors' );
		controller.activate();
		expect( controller.theme ).toBe( 'default' );
		expect( isColorblind() ).toBe( false );

		controller.applyPreference( 'theme', 'colorblind' );
		expect( controller.theme ).toBe( 'colorblind' );
		expect( isColorblind() ).toBe( true );

		controller.applyPreference( 'theme', 'no-highlight' );
		expect( controller.syntaxHighlightingEnabled ).toBe( false );
		expect( isColorblind() ).toBe( false );
	} );

	it( 'should pick up a colorblind setting from the pre-themes user option', () => {
		// CodeMirrorPreferences migrates usecodemirror-colorblind in its constructor.
		const origGet = mw.user.options.get;
		mw.user.options.get = jest.fn().mockImplementation(
			( key ) => ( key === 'usecodemirror-colorblind' ? 1 : null )
		);
		try {
			const themed = new CodeMirrorVisualEditorHighlight(
				getMockSurface( 'x' ), langSupport
			);
			themed.activate();
			expect( themed.theme ).toBe( 'colorblind' );
		} finally {
			mw.user.options.get = origGet;
		}
	} );
} );

describe( 'headings', () => {
	const classes = ( node ) => Array.from( node.$element[ 0 ].classList );

	it( 'should set a level class on each heading line', () => {
		const doc = '= one =\n== two ==\n====== six ======\nplain text';
		const headed = newThemedController( 'default', doc );
		headed.activate();
		headed.updateHeadings();
		const nodes = headed.surface.lineNodes;
		expect( classes( nodes[ 0 ] ) ).toContain( 'cm-mw-ve-section-1' );
		expect( classes( nodes[ 1 ] ) ).toContain( 'cm-mw-ve-section-2' );
		expect( classes( nodes[ 2 ] ) ).toContain( 'cm-mw-ve-section-6' );
		expect( classes( nodes[ 3 ] ) ).toEqual( [] );
	} );

	it( 'should not treat unbalanced or empty markers as headings', () => {
		// '=' and '==' have no content between the markers; MediaWiki requires some.
		const headed = newThemedController( 'default', '=\n==\nplain =' );
		headed.activate();
		headed.updateHeadings();
		headed.surface.lineNodes.forEach(
			( node ) => expect( classes( node ) ).toEqual( [] )
		);
		expect( headed.headingLines.size ).toBe( 0 );
	} );

	it( 'should drop the class when a line stops being a heading', () => {
		const headed = newThemedController( 'default', '== two ==\nplain' );
		headed.activate();
		headed.updateHeadings();
		const node = headed.surface.lineNodes[ 0 ];
		expect( classes( node ) ).toContain( 'cm-mw-ve-section-2' );

		headed.tokenizer = headed.tokenizer.update(
			{ changes: { from: 0, to: 9, insert: 'nope' } }
		).state;
		headed.updateHeadings();
		expect( classes( node ) ).toEqual( [] );
		expect( headed.headingLines.size ).toBe( 0 );
	} );

	it( 'should swap the class when the heading level changes', () => {
		const headed = newThemedController( 'default', '== two ==\nplain' );
		headed.activate();
		headed.updateHeadings();
		headed.tokenizer = headed.tokenizer.update(
			{ changes: { from: 0, to: 9, insert: '=== three ===' } }
		).state;
		headed.updateHeadings();
		expect( classes( headed.surface.lineNodes[ 0 ] ) ).toEqual( [ 'cm-mw-ve-section-3' ] );
	} );

	it( 'should clear the classes on deactivate', () => {
		const headed = newThemedController( 'default', '= one =\nplain' );
		headed.activate();
		headed.updateHeadings();
		headed.deactivate();
		expect( classes( headed.surface.lineNodes[ 0 ] ) ).toEqual( [] );
		expect( headed.headingLines.size ).toBe( 0 );
	} );

	it( 'should not apply headings under the no-highlight theme', () => {
		// The .cm-mw-section-* rules live inside the theme-scoped block upstream, so the
		// no-highlight theme drops heading sizes there too.
		const headed = newThemedController( 'no-highlight', '= one =\nplain' );
		headed.activate();
		headed.updateHeadings();
		expect( classes( headed.surface.lineNodes[ 0 ] ) ).toEqual( [] );
	} );

	it( 'should coalesce passes and run one when the frame fires', () => {
		const spy = jest.spyOn( controller, 'updateHeadings' );
		controller.scheduleHeadings();
		controller.scheduleHeadings();
		expect( global.requestAnimationFrame ).toHaveBeenCalledTimes( 1 );
		global.requestAnimationFrame.mock.calls[ 0 ][ 0 ]();
		expect( spy ).toHaveBeenCalledTimes( 1 );
		expect( controller.headingFrameHandle ).toBeNull();
	} );

	it( 'should leave an unchanged heading alone across passes', () => {
		const headed = newThemedController( 'default', '== two ==\nplain' );
		headed.activate();
		headed.updateHeadings();
		headed.updateHeadings();
		expect( classes( headed.surface.lineNodes[ 0 ] ) ).toEqual( [ 'cm-mw-ve-section-2' ] );
		expect( headed.headingLines.get( 1 ) ).toBe( 2 );
	} );

	it( 'should ask the line-number gutter to re-measure when headings change', () => {
		// Applying a class emits no 'position' event, so the numbers would otherwise keep the
		// line heights they were first rendered with.
		const headed = newThemedController( 'default', '== two ==\nplain' );
		headed.activate();
		const spy = jest.spyOn( headed.lineNumberGutter, 'update' );
		headed.updateHeadings();
		expect( spy ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'should not re-measure when the heading set is unchanged', () => {
		const headed = newThemedController( 'default', '== two ==\nplain' );
		headed.activate();
		headed.updateHeadings();
		const spy = jest.spyOn( headed.lineNumberGutter, 'update' );
		headed.updateHeadings();
		expect( spy ).not.toHaveBeenCalled();
	} );

	it( 'should schedule an update on document change, not on scroll', () => {
		controller.activate();
		// activate() leaves both frames pending (the rAF mock never runs the callback).
		controller.frameHandle = null;
		controller.headingFrameHandle = null;

		// The scroll/resize/position path refreshes the viewport only.
		controller.scheduleRefresh();
		expect( controller.frameHandle ).not.toBeNull();
		expect( controller.headingFrameHandle ).toBeNull();

		// An edit schedules a heading pass too.
		controller.onDocumentPrecommit( { operations: [] } );
		expect( controller.headingFrameHandle ).not.toBeNull();
	} );
} );

describe( 'active line', () => {
	const classes = ( node ) => Array.from( node.$element[ 0 ].classList );

	/**
	 * @param {string} doc
	 * @return {Object} Controller with the activeLine preference on
	 */
	const newActiveLineController = ( doc ) => {
		const origGet = mw.user.options.get;
		mw.user.options.get = jest.fn().mockImplementation( ( key ) => (
			key === 'codemirror-preferences' ? JSON.stringify( { activeLine: 1 } ) : null
		) );
		try {
			return new CodeMirrorVisualEditorHighlight( getMockSurface( doc ), langSupport );
		} finally {
			mw.user.options.get = origGet;
		}
	};

	it( 'should mark the line holding the cursor', () => {
		const active = newActiveLineController( 'one\ntwo\nthree' );
		active.activate();
		// Identity offset mapping, so offset 5 is on line 2.
		active.surface.setCursor( 5 );
		active.updateActiveLine();
		const nodes = active.surface.lineNodes;
		expect( classes( nodes[ 1 ] ) ).toContain( 'cm-mw-ve-activeLine' );
		expect( classes( nodes[ 0 ] ) ).toEqual( [] );
		expect( classes( nodes[ 2 ] ) ).toEqual( [] );
	} );

	it( 'should move the mark when the cursor changes line', () => {
		const active = newActiveLineController( 'one\ntwo\nthree' );
		active.activate();
		active.surface.setCursor( 1 );
		active.updateActiveLine();
		active.surface.setCursor( 9 );
		active.updateActiveLine();
		const nodes = active.surface.lineNodes;
		expect( classes( nodes[ 0 ] ) ).toEqual( [] );
		expect( classes( nodes[ 2 ] ) ).toContain( 'cm-mw-ve-activeLine' );
	} );

	it( 'should follow the focus end of a selection, not its anchor', () => {
		const active = newActiveLineController( 'one\ntwo\nthree' );
		active.activate();
		// Anchored on line 1, focus on line 3.
		active.surface.setCursor( 1, false, 9 );
		active.updateActiveLine();
		expect( classes( active.surface.lineNodes[ 2 ] ) ).toContain( 'cm-mw-ve-activeLine' );
	} );

	it( 'should clear the mark it set after the line numbers shift beneath it', () => {
		// An edit above the marked line moves it to a new index. Clearing by index would strip
		// the class off whichever node moved into the old slot, stranding this one.
		const active = newActiveLineController( 'one\ntwo\nthree' );
		active.activate();
		active.surface.setCursor( 5 );
		active.updateActiveLine();
		const marked = active.surface.lineNodes[ 1 ];
		expect( classes( marked ) ).toContain( 'cm-mw-ve-activeLine' );

		// Everything shifts down one, then the cursor moves to the new first line.
		active.surface.lineNodes.unshift( { $element: $( '<p>' ).text( 'inserted' ) } );
		active.surface.setCursor( 1 );
		active.updateActiveLine();

		expect( classes( marked ) ).toEqual( [] );
		expect( active.surface.lineNodes.filter(
			( node ) => classes( node ).includes( 'cm-mw-ve-activeLine' )
		).length ).toBe( 1 );
	} );

	it( 'should clear the mark when there is no selection', () => {
		const active = newActiveLineController( 'one\ntwo' );
		active.activate();
		active.surface.setCursor( 5 );
		active.updateActiveLine();
		active.surface.model.getSelection.mockReturnValue( null );
		active.updateActiveLine();
		expect( classes( active.surface.lineNodes[ 1 ] ) ).toEqual( [] );
	} );

	it( 'should do nothing when the preference is off', () => {
		controller.activate();
		surface.setCursor( 1 );
		controller.updateActiveLine();
		expect( classes( surface.lineNodes[ 0 ] ) ).toEqual( [] );
	} );

	it( 'should clear the mark on deactivate', () => {
		const active = newActiveLineController( 'one\ntwo' );
		active.activate();
		active.surface.setCursor( 5 );
		active.updateActiveLine();
		active.deactivate();
		expect( classes( active.surface.lineNodes[ 1 ] ) ).toEqual( [] );
	} );

	it( 'should take the preference from the registry, not a field', () => {
		const active = newActiveLineController( 'one\ntwo' );
		const isEnabled = ( cm ) => cm.extensionRegistry.isEnabled( 'activeLine', cm );
		// Nothing is registered against a controller with no tokenizer yet.
		expect( isEnabled( active ) ).toBe( false );
		active.activate();
		expect( isEnabled( active ) ).toBe( true );
		controller.activate();
		expect( isEnabled( controller ) ).toBe( false );
	} );

	it( 'should track the cursor once the preference is turned on', () => {
		// The shared controller has the preference off, and one line to mark.
		controller.activate();
		surface.setCursor( 2 );
		controller.updateActiveLine();
		expect( classes( surface.lineNodes[ 0 ] ) ).toEqual( [] );

		controller.applyPreference( 'activeLine', true );

		// Reconfiguring the compartment both binds and paints, with no second call here.
		expect( controller.extensionRegistry.isEnabled( 'activeLine', controller ) )
			.toBe( true );
		expect( classes( surface.lineNodes[ 0 ] ) ).toContain( 'cm-mw-ve-activeLine' );
	} );

	it( 'should stop tracking and clear the mark when turned off', () => {
		const active = newActiveLineController( 'one\ntwo' );
		active.activate();
		active.surface.setCursor( 5 );
		active.updateActiveLine();

		active.applyPreference( 'activeLine', false );

		expect( active.extensionRegistry.isEnabled( 'activeLine', active ) ).toBe( false );
		expect( active.surface.model.off )
			.toHaveBeenCalledWith( 'select', expect.any( Function ) );
		expect( classes( active.surface.lineNodes[ 1 ] ) ).toEqual( [] );
	} );
} );

describe( 'trailing whitespace', () => {
	/**
	 * @param {string} doc
	 * @return {Object} Controller with the trailingWhitespace preference on
	 */
	const newTrailingController = ( doc ) => {
		const origGet = mw.user.options.get;
		mw.user.options.get = jest.fn().mockImplementation( ( key ) => (
			key === 'codemirror-preferences' ? JSON.stringify( { trailingWhitespace: 1 } ) : null
		) );
		try {
			return new CodeMirrorVisualEditorHighlight( getMockSurface( doc ), langSupport );
		} finally {
			mw.user.options.get = origGet;
		}
	};

	/**
	 * @param {Object} trailing Controller
	 * @return {Array} Ranges drawn for the trailing-whitespace group
	 */
	const drawnRanges = ( trailing ) => trailing.surface.selectionManager.drawSelections.mock.calls
		.filter( ( call ) => call[ 0 ] === 'cm-trailing-whitespace' )
		.pop()[ 1 ]
		.map( ( selection ) => ( {
			from: selection.range.from,
			to: selection.range.to
		} ) );

	it( 'should highlight trailing spaces and tabs', () => {
		// Line 1 ends in two spaces, line 3 in a tab; line 2 is clean.
		const trailing = newTrailingController( 'one  \ntwo\nthree\t' );
		trailing.activate();
		trailing.updateTrailingWhitespace();
		// Identity offset mapping plus one per preceding line boundary: source 3-5 on line 1,
		// source 15-16 on line 3.
		expect( drawnRanges( trailing ) ).toEqual( [
			{ from: 4, to: 6 },
			{ from: 18, to: 19 }
		] );
	} );

	it( 'should draw nothing when every line is clean', () => {
		const trailing = newTrailingController( 'one\ntwo' );
		trailing.activate();
		trailing.updateTrailingWhitespace();
		expect( trailing.surface.selectionManager.drawSelections )
			.not.toHaveBeenCalledWith( 'cm-trailing-whitespace', expect.anything(), expect.anything() );
	} );

	it( 'should treat a whitespace-only line as trailing', () => {
		const trailing = newTrailingController( 'one\n   \ntwo' );
		trailing.activate();
		trailing.updateTrailingWhitespace();
		expect( drawnRanges( trailing ) ).toEqual( [ { from: 6, to: 9 } ] );
	} );

	it( 'should do nothing when the preference is off', () => {
		controller.activate();
		controller.updateTrailingWhitespace();
		expect( controller.surface.selectionManager.drawSelections )
			.not.toHaveBeenCalledWith( 'cm-trailing-whitespace', expect.anything(), expect.anything() );
	} );

	it( 'should clear the group on deactivate', () => {
		const trailing = newTrailingController( 'one  ' );
		trailing.activate();
		trailing.updateTrailingWhitespace();
		trailing.deactivate();
		expect( trailing.surface.selectionManager.drawSelections )
			.toHaveBeenLastCalledWith( 'cm-trailing-whitespace', [] );
	} );

	it( 'should clear the group when the preference is turned off', () => {
		const trailing = newTrailingController( 'one  ' );
		trailing.activate();
		trailing.updateTrailingWhitespace();

		trailing.applyPreference( 'trailingWhitespace', false );

		expect( trailing.extensionRegistry.isEnabled( 'trailingWhitespace', trailing ) )
			.toBe( false );
		expect( trailing.surface.selectionManager.drawSelections )
			.toHaveBeenLastCalledWith( 'cm-trailing-whitespace', [] );
	} );

	it( 'should start drawing once the preference is turned on', () => {
		surface = getMockSurface( 'one  ' );
		controller = new CodeMirrorVisualEditorHighlight( surface, langSupport );
		controller.activate();
		expect( surface.selectionManager.drawSelections )
			.not.toHaveBeenCalledWith( 'cm-trailing-whitespace', expect.anything(), expect.anything() );

		controller.applyPreference( 'trailingWhitespace', true );

		// Reconfiguring schedules the pass, so only the frame is left to run.
		controller.updateTrailingWhitespace();
		expect( drawnRanges( controller ) ).toEqual( [ { from: 4, to: 6 } ] );
	} );
} );

describe( 'whitespace', () => {
	/**
	 * @param {string} doc
	 * @param {Object} [prefs] Extra preferences to store alongside `whitespace`
	 * @return {Object} Controller with the whitespace preference on
	 */
	const newWhitespaceController = ( doc, prefs = {} ) => {
		const origGet = mw.user.options.get;
		mw.user.options.get = jest.fn().mockImplementation( ( key ) => (
			key === 'codemirror-preferences' ?
				JSON.stringify( Object.assign( { whitespace: 1 }, prefs ) ) :
				null
		) );
		try {
			return new CodeMirrorVisualEditorHighlight( getMockSurface( doc ), langSupport );
		} finally {
			mw.user.options.get = origGet;
		}
	};

	/**
	 * @param {Object} ws Controller
	 * @return {Array} Ranges drawn for the whitespace group
	 */
	const drawnRanges = ( ws ) => ws.surface.selectionManager.drawSelections.mock.calls
		.filter( ( call ) => call[ 0 ] === 'cm-whitespace' )
		.pop()[ 1 ]
		.map( ( selection ) => ( { from: selection.range.from, to: selection.range.to } ) );

	it( 'should highlight each run of spaces and tabs', () => {
		const ws = newWhitespaceController( 'a bb\tc' );
		ws.activate();
		ws.refresh();
		// Single line, so surface offsets are source offsets plus one.
		expect( drawnRanges( ws ) ).toEqual( [
			{ from: 2, to: 3 },
			{ from: 5, to: 6 }
		] );
	} );

	it( 'should treat a run of several spaces as one range', () => {
		const ws = newWhitespaceController( 'a   b' );
		ws.activate();
		ws.refresh();
		expect( drawnRanges( ws ) ).toEqual( [ { from: 2, to: 5 } ] );
	} );

	it( 'should draw nothing when there is no whitespace', () => {
		const ws = newWhitespaceController( 'abc' );
		ws.activate();
		ws.refresh();
		expect( ws.surface.selectionManager.drawSelections )
			.not.toHaveBeenCalledWith( 'cm-whitespace', expect.anything(), expect.anything() );
	} );

	it( 'should keep running under the no-highlight theme', () => {
		const ws = newWhitespaceController( 'a b', { theme: 'no-highlight' } );
		// The preference lives in the tokenizer, so it only counts once there is one.
		ws.activate();
		expect( ws.syntaxHighlightingEnabled ).toBe( false );
		expect( ws.viewportPassEnabled ).toBe( true );
		ws.refresh();
		expect( drawnRanges( ws ) ).toEqual( [ { from: 2, to: 3 } ] );
	} );

	it( 'should stop the viewport pass when the last consumer is turned off', () => {
		const ws = newWhitespaceController( 'a b', { theme: 'no-highlight' } );
		ws.activate();
		ws.applyPreference( 'whitespace', false );
		expect( ws.viewportPassEnabled ).toBe( false );
		expect( ws.surface.view.off ).toHaveBeenCalledWith( 'position', expect.any( Function ) );
	} );

	it( 'should do nothing when the preference is off', () => {
		controller.activate();
		controller.refresh();
		expect( controller.surface.selectionManager.drawSelections )
			.not.toHaveBeenCalledWith( 'cm-whitespace', expect.anything(), expect.anything() );
	} );

	it( 'should clear the group on deactivate', () => {
		const ws = newWhitespaceController( 'a b' );
		ws.activate();
		ws.refresh();
		ws.deactivate();
		expect( ws.surface.selectionManager.drawSelections )
			.toHaveBeenLastCalledWith( 'cm-whitespace', [] );
	} );

	it( 'should take the preference from the registry, not a field', () => {
		const ws = newWhitespaceController( 'a b' );
		const isEnabled = ( cm ) => cm.extensionRegistry.isEnabled( 'whitespace', cm );
		// Nothing is registered against a controller with no tokenizer yet.
		expect( isEnabled( ws ) ).toBe( false );
		ws.activate();
		expect( isEnabled( ws ) ).toBe( true );
		controller.activate();
		expect( isEnabled( controller ) ).toBe( false );
	} );

	it( 'should start drawing once the preference is turned on', () => {
		controller.activate();
		controller.refresh();
		expect( controller.surface.selectionManager.drawSelections )
			.not.toHaveBeenCalledWith( 'cm-whitespace', expect.anything(), expect.anything() );

		controller.applyPreference( 'whitespace', true );

		expect( controller.extensionRegistry.isEnabled( 'whitespace', controller ) )
			.toBe( true );
		// Reconfiguring the compartment schedules the pass, so only the frame is needed.
		controller.refresh();
		expect( drawnRanges( controller ) ).toEqual( [ { from: 8, to: 9 } ] );
	} );
} );

describe( 'toggle', () => {
	it( 'should activate when forced on and deactivate when forced off', () => {
		controller.toggle( true );
		expect( controller.isActive ).toBe( true );
		controller.toggle( false );
		expect( controller.isActive ).toBe( false );
	} );

	it( 'should invert the current state when called with no argument', () => {
		expect( controller.isActive ).toBe( false );
		controller.toggle();
		expect( controller.isActive ).toBe( true );
		controller.toggle();
		expect( controller.isActive ).toBe( false );
	} );

	it( 'should fire the toggle hook, as the other integrations do', () => {
		controller.initialize();
		const toggled = [];
		mw.hook( 'ext.CodeMirror.toggle' ).add( ( enabled ) => {
			toggled.push( enabled );
		} );
		controller.toggle( false );
		controller.toggle( true );
		// Only when the state actually changed, so the repeat is not reported.
		controller.toggle( true );
		expect( toggled ).toEqual( [ false, true ] );
	} );

	it( 'should go through initialize(), so the API check cannot be bypassed', () => {
		delete global.CSS.highlights;
		const warnSpy = jest.spyOn( console, 'warn' ).mockImplementation( () => {} );
		const unsupported = new CodeMirrorVisualEditorHighlight( getMockSurface( 'x' ), langSupport );

		unsupported.toggle( true );

		expect( unsupported.isActive ).toBe( false );
		expect( unsupported.tokenizer ).toBeNull();
		expect( mw.log.warn ).toHaveBeenCalledWith(
			'[CodeMirror] CSS Custom Highlight API is unavailable; VisualEditor highlighting is disabled.'
		);
		warnSpy.mockRestore();
	} );
} );

describe( 'refresh', () => {
	beforeEach( () => {
		controller.activate();
		// activate() schedules a refresh via the mocked rAF; run refresh directly instead.
		surface.selectionManager.drawSelections.mockClear();
	} );

	it( 'should paint one highlight group per CSS class in the viewport', () => {
		controller.refresh();
		const drawCalls = surface.selectionManager.drawSelections.mock.calls;
		const drawnNames = drawCalls.map( ( call ) => call[ 0 ] );
		expect( drawnNames.length ).toBeGreaterThan( 0 );
		// Every group name is namespaced, and the template name is highlighted.
		drawnNames.forEach( ( name ) => expect( name ).toMatch( /^syntax-cm-mw-/ ) );
		expect( drawnNames ).toContain( 'syntax-cm-mw-template-name' );
		expect( controller.drawnGroups.size ).toBe( drawnNames.length );
		// drawSelections is called with the custom-highlight option, not rects.
		const options = surface.selectionManager.drawSelections.mock.calls[ 0 ][ 2 ];
		expect( options.showRects ).toBe( false );
		expect( options.showCustomHighlight ).toBe( true );
	} );

	it( 'should pass pre-resolved custom highlight ranges to drawSelections', () => {
		controller.refresh();
		const options = surface.selectionManager.drawSelections.mock.calls[ 0 ][ 2 ];
		expect( options.customHighlightRanges instanceof Map ).toBe( true );
		expect( options.customHighlightRanges.size ).toBeGreaterThan( 0 );
	} );

	it( 'should remove groups that are no longer present in the viewport', () => {
		controller.refresh();
		controller.drawnGroups.add( 'syntax-cm-mw-gone' );
		controller.refresh();
		expect( surface.selectionManager.drawSelections ).toHaveBeenCalledWith( 'syntax-cm-mw-gone', [] );
		expect( controller.drawnGroups.has( 'syntax-cm-mw-gone' ) ).toBe( false );
	} );

	it( 'should do nothing when there is no viewport range', () => {
		surface.view.getViewportRange.mockReturnValue( null );
		controller.refresh();
		expect( surface.selectionManager.drawSelections ).not.toHaveBeenCalled();
	} );

	it( 'should do nothing when inactive', () => {
		controller.deactivate();
		controller.refresh();
		expect( surface.selectionManager.drawSelections ).not.toHaveBeenCalled();
	} );
} );

describe( 'getSurfaceOffsetFromSourceOffset', () => {
	it( 'matches ve.dm.Surface#getOffsetFromSourceOffset (source offset + line number)', () => {
		// "ab\n{{c}}\nde": line 1 = ab, line 2 = {{c}}, line 3 = de.
		const multiline = getMockSurface( 'ab\n{{c}}\nde' );
		const ctrl = new CodeMirrorVisualEditorHighlight( multiline, langSupport );
		ctrl.activate();
		// [ sourceOffset, expected surfaceOffset ]; boundaries included.
		[
			[ 0, 1 ], // start of line 1
			[ 2, 3 ], // the first newline (end of line 1)
			[ 3, 5 ], // start of line 2
			[ 7, 9 ], // inside line 2
			[ 8, 10 ], // the second newline (end of line 2)
			[ 9, 12 ] // start of line 3
		].forEach( ( [ source, expected ] ) => {
			expect( ctrl.getSurfaceOffsetFromSourceOffset( source ) ).toBe( expected );
		} );
		ctrl.deactivate();
	} );
} );

describe( 'getHighlightRange', () => {
	it( 'resolves a single-line token to a Range in its line text node', () => {
		const surf = getMockSurface( 'ab {{c}} de' );
		const ctrl = new CodeMirrorVisualEditorHighlight( surf, langSupport );
		ctrl.activate();
		const lines = surf.getView().getDocument().getDocumentNode().children;
		const textNode = lines[ 0 ].$element[ 0 ].firstChild;
		const range = ctrl.getHighlightRange( 3, 8 ); // "{{c}}"
		// Compare as a boolean so a failure never asks Jest to serialise a DOM node.
		expect( range.startContainer === textNode ).toBe( true );
		expect( range.startOffset ).toBe( 3 );
		expect( range.endOffset ).toBe( 8 );
		ctrl.deactivate();
	} );

	it( 'returns null (fall back to getNativeRange) for a token spanning lines', () => {
		const surf = getMockSurface( 'ab\ncd' );
		const ctrl = new CodeMirrorVisualEditorHighlight( surf, langSupport );
		ctrl.activate();
		expect( ctrl.getHighlightRange( 0, 4 ) === null ).toBe( true );
		ctrl.deactivate();
	} );
} );

describe( 'onDocumentPrecommit', () => {
	beforeEach( () => {
		controller.activate();
	} );

	it( 'should apply a plain replace as an incremental change, staying in sync', () => {
		// Replace the first character ("{") with "X".
		controller.onDocumentPrecommit( {
			operations: [
				{ type: 'replace', remove: [ '{' ], insert: [ 'X' ] }
			]
		} );
		expect( controller.tokenizer.doc.toString() ).toBe( 'X{Foo}} [[Bar]]' );
		expect( controller.tokenizer.doc.length ).toBe( surface.getDom().length );
	} );

	it( 'should honour a leading retain when computing offsets', () => {
		// Retain 2, then insert "AB" at offset 2.
		controller.onDocumentPrecommit( {
			operations: [
				{ type: 'retain', length: 2 },
				{ type: 'replace', remove: [], insert: [ 'A', 'B' ] }
			]
		} );
		expect( controller.tokenizer.doc.toString() ).toBe( '{{ABFoo}} [[Bar]]' );
		expect( surface.model.getSourceOffsetFromOffset ).toHaveBeenCalledWith( 2 );
	} );

	it( 'should trim the extra trailing newline from a full setContents replace (T382769)', () => {
		const docLength = controller.tokenizer.doc.length;
		// textSelection( 'setContents' ) yields a range one past the end plus a trailing newline.
		surface.model.getSourceOffsetFromOffset
			.mockReturnValueOnce( 0 ) // from
			.mockReturnValueOnce( docLength + 1 ); // to (exceeds the document by one)
		controller.onDocumentPrecommit( {
			operations: [
				{ type: 'replace', remove: new Array( docLength ), insert: [ 'H', 'i', '\n' ] }
			]
		} );
		// The trailing newline is dropped and the range clamped, so the doc becomes exactly "Hi".
		expect( controller.tokenizer.doc.toString() ).toBe( 'Hi' );
	} );

	it( 'should be a no-op when there is no tokenizer', () => {
		controller.tokenizer = null;
		expect( () => controller.onDocumentPrecommit( { operations: [] } ) ).not.toThrow();
	} );
} );

describe( 'scheduleRefresh', () => {
	it( 'should coalesce multiple calls into a single animation frame', () => {
		controller.scheduleRefresh();
		controller.scheduleRefresh();
		controller.scheduleRefresh();
		expect( global.requestAnimationFrame ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'should run the refresh and clear the frame handle when the frame fires', () => {
		const refreshSpy = jest.spyOn( controller, 'refresh' );
		controller.scheduleRefresh();
		const frameCallback = global.requestAnimationFrame.mock.calls[ 0 ][ 0 ];
		frameCallback();
		expect( refreshSpy ).toHaveBeenCalledTimes( 1 );
		expect( controller.frameHandle ).toBeNull();
	} );
} );

describe( 'suspending while a window is open', () => {
	// OOUI passes the 'closing' handler a promise that resolves once the window has gone.
	const closed = ( resolve = true ) => {
		const callbacks = [];
		return {
			always: ( callback ) => {
				callbacks.push( callback );
				if ( resolve ) {
					callback();
				}
			},
			settle: () => callbacks.forEach( ( callback ) => callback() )
		};
	};

	it( 'should watch the modal window manager while active', () => {
		controller.activate();
		expect( surface.dialogs.connect ).toHaveBeenCalledWith( controller, {
			opening: 'onWindowOpening',
			closing: 'onWindowClosing'
		} );
		controller.deactivate();
		expect( surface.dialogs.disconnect ).toHaveBeenCalledWith( controller );
	} );

	it( 'should clear the range-drawing groups when a window opens', () => {
		controller.activate();
		controller.drawnGroups.add( 'syntax-cm-mw-template-name' );
		controller.onWindowOpening();
		expect( controller.suspended ).toBe( true );
		expect( surface.selectionManager.drawSelections )
			.toHaveBeenCalledWith( 'syntax-cm-mw-template-name', [] );
		expect( controller.drawnGroups.size ).toBe( 0 );
	} );

	it( 'should not redraw while suspended', () => {
		controller.activate();
		controller.onWindowOpening();
		global.requestAnimationFrame.mockClear();
		controller.scheduleRefresh();
		controller.scheduleBracketMatch();
		controller.scheduleTrailingWhitespace();
		expect( global.requestAnimationFrame ).not.toHaveBeenCalled();
	} );

	it( 'should redraw only once the window has finished closing', () => {
		controller.activate();
		controller.onWindowOpening();
		const promise = closed( false );
		controller.onWindowClosing( {}, promise );
		// Still on screen, so still suspended.
		expect( controller.suspended ).toBe( true );
		promise.settle();
		expect( controller.suspended ).toBe( false );
	} );

	it( 'should stay suspended until the last of several windows closes', () => {
		controller.activate();
		controller.onWindowOpening();
		controller.onWindowOpening();
		controller.onWindowClosing( {}, closed() );
		expect( controller.suspended ).toBe( true );
		controller.onWindowClosing( {}, closed() );
		expect( controller.suspended ).toBe( false );
	} );

	it( 'should suspend when activated underneath an open window', () => {
		surface.dialogs.getCurrentWindow.mockReturnValue( {} );
		controller.activate();
		expect( controller.suspended ).toBe( true );
	} );

	it( 'should resume as soon as suspendWhileWindowOpen is turned off', () => {
		controller.activate();
		controller.onWindowOpening();
		expect( controller.suspended ).toBe( true );
		controller.suspendWhileWindowOpen = false;
		expect( controller.suspended ).toBe( false );
		// And it stays drawn while the window is still open.
		controller.onWindowOpening();
		expect( controller.suspended ).toBe( false );
	} );

	it( 'should suspend on being turned back on under an open window', () => {
		controller.activate();
		controller.suspendWhileWindowOpen = false;
		controller.onWindowOpening();
		controller.suspendWhileWindowOpen = true;
		expect( controller.suspendWhileWindowOpen ).toBe( true );
		expect( controller.suspended ).toBe( true );
	} );

	it( 'should leave the headings and the active line alone', () => {
		controller.activate();
		const headingsSpy = jest.spyOn( controller, 'clearHeadings' );
		const activeLineSpy = jest.spyOn( controller, 'clearActiveLine' );
		controller.onWindowOpening();
		expect( headingsSpy ).not.toHaveBeenCalled();
		expect( activeLineSpy ).not.toHaveBeenCalled();
	} );
} );

describe( 'setCodeMirrorPreference', () => {
	it( 'should skip unnamed users', () => {
		mw.user.isNamed.mockReturnValueOnce( false );
		controller.setCodeMirrorPreference( true );
		expect( mw.Api.prototype.saveOption ).not.toHaveBeenCalled();
	} );

	it( 'should not re-save when the preference is already enabled', () => {
		mw.user.options.get = jest.fn().mockReturnValue( 1 );
		controller.setCodeMirrorPreference( true );
		expect( mw.Api.prototype.saveOption ).not.toHaveBeenCalled();
	} );

	it( 'should save the preference when it differs', () => {
		mw.user.options.get = jest.fn().mockReturnValue( 0 );
		controller.setCodeMirrorPreference( true );
		expect( mw.Api.prototype.saveOption )
			.toHaveBeenCalledWith( 'usecodemirror', 1, { global: 'update' } );
		expect( mw.user.options.set ).toHaveBeenCalledWith( 'usecodemirror', 1 );
	} );
} );

describe( 'openLinks', () => {
	/**
	 * The MediaWiki mode's helpers, as the controller receives them.
	 *
	 * @return {Object}
	 */
	// langSupport is the real MediaWiki mode, which supplies openLinks, so a controller built
	// with it has link opening; one built without any is the unavailable case.

	/**
	 * @param {Object} [support] Language support, defaulting to the MediaWiki mode
	 * @return {Object}
	 */
	const newController = ( support = langSupport ) => new CodeMirrorVisualEditorHighlight(
		getMockSurface( '{{Foo}} [[Bar]]' ), support
	);

	/**
	 * The drawSelections calls for the open-link group.
	 *
	 * @param {Object} s Mock surface
	 * @return {Array[]}
	 */
	const openLinkCalls = ( s ) => s.selectionManager.drawSelections.mock.calls
		.filter( ( call ) => call[ 0 ] === 'cm-open-link' );

	it( 'should stay unavailable when the mode supplies no resolver', () => {
		// The mode with its openLinks shadowed away, as a mode without link resolution.
		const noLinks = Object.create( langSupport, { openLinks: { value: undefined } } );
		const c = newController( noLinks );
		expect( c.openLinks ).toBeNull();
		expect( c.openLinksEnabled ).toBe( false );
		expect( c.supportedPreferences ).not.toContain( 'openLinks' );
	} );

	it( 'should offer the preference once the resolver is supplied', () => {
		const c = newController();
		expect( c.openLinks ).not.toBeNull();
		// On by default, as in the non-VE editor.
		expect( c.openLinksEnabled ).toBe( true );
		expect( c.supportedPreferences ).toContain( 'openLinks' );
	} );

	it( 'should read the tokenizer state, which outlives the no-highlight theme', () => {
		const c = newController();
		c.activate();
		expect( c.openLinks.config.getState() ).toBe( c.tokenizer );
	} );

	it( 'should enable the handler on activate and disable it on deactivate', () => {
		const c = newController();
		const spy = jest.spyOn( c.openLinks, 'setEnabled' );
		c.activate();
		expect( spy ).toHaveBeenCalledWith( true );
		c.deactivate();
		expect( spy ).toHaveBeenLastCalledWith( false );
	} );

	it( 'should apply the preference to the running handler', () => {
		const c = newController();
		c.activate();
		const spy = jest.spyOn( c.openLinks, 'setEnabled' );
		c.applyPreference( 'openLinks', false );
		expect( c.openLinksEnabled ).toBe( false );
		expect( spy ).toHaveBeenCalledWith( false );
		c.applyPreference( 'openLinks', true );
		expect( spy ).toHaveBeenLastCalledWith( true );
	} );

	it( 'should not enable the handler while inactive', () => {
		// With no tokenizer there is nothing to reconfigure, so the registry says as much.
		const warnSpy = jest.spyOn( console, 'warn' ).mockImplementation( () => {} );
		const c = newController();
		const spy = jest.spyOn( c.openLinks, 'setEnabled' );
		c.applyPreference( 'openLinks', true );
		expect( spy ).toHaveBeenCalledWith( false );
		warnSpy.mockRestore();
	} );

	it( 'should mark the link as its own highlight group, and unmark it again', () => {
		const c = newController();
		const s = c.surface;
		c.activate();
		s.selectionManager.drawSelections.mockClear();
		expect( c.drawOpenLink( 2, 5 ) ).toBe( true );
		const calls = openLinkCalls( s );
		expect( calls.length ).toBe( 1 );
		expect( calls[ 0 ][ 1 ].length ).toBe( 1 );
		expect( calls[ 0 ][ 2 ] ).toEqual( { showRects: false, showCustomHighlight: true } );
		s.selectionManager.drawSelections.mockClear();
		c.clearOpenLink();
		expect( openLinkCalls( s )[ 0 ][ 1 ] ).toEqual( [] );
	} );

	it( 'should raise the group above the syntax ones', () => {
		const c = newController();
		c.activate();
		// Stand in for what SelectionManager registers, which the mock does not do.
		const highlight = { priority: 0 };
		CSS.highlights.set( 'visualeditor-cm-open-link', highlight );
		c.drawOpenLink( 2, 5 );
		expect( highlight.priority ).toBe( 1 );
	} );

	it( 'should not require the highlight to be registered', () => {
		const c = newController();
		c.activate();
		// No CSS.highlights entry, e.g. where the range resolved to nothing to paint.
		expect( c.drawOpenLink( 2, 5 ) ).toBe( true );
	} );

	it( 'should refuse to mark a range the model rejects', () => {
		const c = newController();
		c.activate();
		c.surface.model.getRangeFromSourceOffsets.mockImplementation( () => {
			throw new Error( 'Offset out of bounds' );
		} );
		expect( c.drawOpenLink( 2, 5 ) ).toBe( false );
	} );

	it( 'should destroy the handler with the controller', () => {
		const c = newController();
		c.activate();
		const spy = jest.spyOn( c.openLinks, 'destroy' );
		c.destroy();
		expect( spy ).toHaveBeenCalled();
	} );
} );

describe( 'CodeMirrorVisualEditor inheritance', () => {
	it( 'should be a CodeMirrorVisualEditor', () => {
		expect( controller ).toBeInstanceOf( CodeMirrorVisualEditor );
	} );

	it( 'should share the surface and preference plumbing with the parent', () => {
		expect( controller.surface ).toBe( surface );
		expect( controller.surfaceView ).toBe( surface.getView() );
		expect( controller.mode ).toBe( 'mediawiki' );
		expect( controller.preferences ).toBeInstanceOf( CodeMirrorPreferences );
		expect( controller.themes ).toBeInstanceOf( CodeMirrorThemes );
		// There is no EditorView, and nothing should have created one.
		expect( controller.view ).toBeNull();
	} );

	it( 'should detach the inherited keymap from mw.hook on destroy', () => {
		expect( controller.preferences.keymap ).toBe( controller.keymap );
		const handler = controller.keymap.hookHandlers[ 'ext.CodeMirror.preferences.ready' ];
		expect( mw.hook.mockHooks[ 'ext.CodeMirror.preferences.ready' ] ).toContain( handler );

		controller.destroy();

		expect( mw.hook.mockHooks[ 'ext.CodeMirror.preferences.ready' ] )
			.not.toContain( handler );
	} );

	describe( 'the Editor seam', () => {
		it( 'should expose the tokenizer as its state', () => {
			expect( controller.state ).toBeNull();
			controller.activate();
			expect( controller.state ).toBe( controller.tokenizer );
			expect( controller.state.doc.toString() ).toBe( '{{Foo}} [[Bar]]' );
		} );

		it( 'should store what a dispatched transaction produces', () => {
			controller.activate();
			const before = controller.tokenizer;
			controller.dispatch( {
				changes: { from: 0, to: controller.state.doc.length, insert: 'baz' }
			} );
			expect( controller.state.doc.toString() ).toBe( 'baz' );
			// A new state, not a mutation of the old one (T387253).
			expect( controller.tokenizer ).not.toBe( before );
			expect( before.doc.toString() ).toBe( '{{Foo}} [[Bar]]' );
		} );

		it( 'should let the extension registry work against it', () => {
			controller.activate();
			// The compartments ride into the tokenizer with preferences.extension, so
			// reconfiguring one has to reach the state through dispatch(). The Extension is
			// arbitrary; tabSize is simply the easiest to observe in a headless state.
			expect( controller.extensionRegistry.isRegistered( 'whitespace', controller ) )
				.toBe( true );
			controller.extensionRegistry.reconfigure(
				'whitespace', controller, EditorState.tabSize.of( 6 )
			);
			expect( controller.state.tabSize ).toBe( 6 );
		} );
	} );

	describe( 'supportedPreferences', () => {
		it( 'should come from the registry rather than a hardcoded list', () => {
			expect( controller.supportedPreferences ).toStrictEqual(
				Object.keys( controller.extensionRegistryDefaults )
			);
			// The theme joins the rest once CodeMirrorThemes' value map is registered.
			controller.activate();
			expect( controller.supportedPreferences.sort() ).toStrictEqual( [
				'activeLine',
				'bracketMatching',
				'highlightRefs',
				'lineNumbering',
				// The mediawiki mode supplies the link helpers, so this is offered too.
				'openLinks',
				'theme',
				'trailingWhitespace',
				'whitespace'
			] );
		} );

		it( 'should not gain preferences it cannot render on initialize', () => {
			// The inherited initialize() registers extensions that need an EditorView,
			// e.g. lint, which would otherwise show up in the preferences tool.
			const before = controller.supportedPreferences.slice();
			controller.initialize();
			// Only the theme, which CodeMirrorThemes registers for every integration.
			expect( controller.supportedPreferences ).toStrictEqual( before.concat( 'theme' ) );
		} );

		it( 'should not offer line numbering in DiscussionTools', () => {
			surface = getMockSurface( '{{Foo}}' );
			surface.setTarget( 'CommentTarget' );
			controller = new CodeMirrorVisualEditorHighlight( surface, langSupport );
			expect( controller.isDiscussionTools ).toBe( true );
			expect( controller.supportedPreferences ).not.toContain( 'lineNumbering' );
			expect( controller.extensionRegistryDefaults.lineNumbering ).toBeUndefined();
		} );
	} );
} );
