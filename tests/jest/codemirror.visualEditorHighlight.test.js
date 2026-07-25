const CodeMirrorVisualEditorHighlight = require( '../../resources/codemirror.visualEditorHighlight.js' );
const { mediawiki, matchTag } = require( '../../resources/modes/mediawiki/codemirror.mediawiki.js' );

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
	const ceDocument = {
		getDocumentNode: jest.fn().mockReturnValue( { children: lineNodes } )
	};
	const surfaceView = {
		// The controller scopes the colorblind theme by adding a class here.
		$element: $( '<div>' ),
		on: jest.fn(),
		off: jest.fn(),
		getViewportRange: jest.fn().mockReturnValue( { start: 0, end: doc.length } ),
		getSelection: jest.fn().mockImplementation( ( selection ) => selection ),
		getSelectionManager: jest.fn().mockReturnValue( selectionManager ),
		getDocument: jest.fn().mockReturnValue( ceDocument )
	};
	return {
		getView: jest.fn().mockReturnValue( surfaceView ),
		getModel: jest.fn().mockReturnValue( model ),
		getMode: jest.fn().mockReturnValue( 'source' ),
		getDom: jest.fn().mockReturnValue( doc ),
		$scrollContainer: { on: jest.fn(), off: jest.fn() },
		$scrollListener: { on: jest.fn(), off: jest.fn() },
		// Exposed for assertions
		model: model,
		documentModel: documentModel,
		view: surfaceView,
		lineNodes: lineNodes,
		selectionManager: selectionManager,
		// Install a collapsed (or ranged) cursor for bracket-matching tests.
		setCursor: ( start, collapsed = true ) => {
			model.getSelection.mockReturnValue( {
				getCoveringRange: () => ( { start, isCollapsed: () => collapsed } )
			} );
		}
	};
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

describe( 'constructor', () => {
	it( 'should detect the CSS Custom Highlight API as supported when present', () => {
		expect( controller.supported ).toBe( true );
		expect( controller.isActive ).toBe( false );
		expect( controller.mode ).toBe( langSupport.language.name );
		expect( controller.highlightStyle ).toBe( langSupport.highlightStyle );
	} );

	it( 'should detect the API as unsupported when window.CSS.highlights is absent', () => {
		delete global.CSS.highlights;
		const unsupported = new CodeMirrorVisualEditorHighlight( surface, langSupport );
		expect( unsupported.supported ).toBe( false );
	} );
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

	it( 'should warn and not activate when the API is unsupported', () => {
		const warnSpy = jest.spyOn( console, 'warn' ).mockImplementation( () => {} );
		delete global.CSS.highlights;
		const unsupported = new CodeMirrorVisualEditorHighlight( surface, langSupport );
		unsupported.activate();
		expect( unsupported.isActive ).toBe( false );
		expect( mw.log.warn ).toHaveBeenCalled();
		warnSpy.mockRestore();
	} );
} );

describe( 'deactivate', () => {
	it( 'should unbind listeners, clear highlights and drop the tokenizer', () => {
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
		expect( controller.tokenizer ).toBeNull();
		expect( controller.isActive ).toBe( false );
	} );

	it( 'should be a no-op when not active', () => {
		controller.deactivate();
		expect( surface.documentModel.off ).not.toHaveBeenCalled();
	} );
} );

describe( 'destroy', () => {
	it( 'should deactivate the controller', () => {
		controller.activate();
		controller.destroy();
		expect( controller.isActive ).toBe( false );
		expect( controller.tokenizer ).toBeNull();
	} );
} );

describe( 'bracket matching', () => {
	const bracketCalls = () => surface.selectionManager.drawSelections.mock.calls
		.filter( ( call ) => /bracket/.test( call[ 0 ] ) );

	it( 'should default to enabled and bind the select listener on activate', () => {
		expect( controller.bracketMatchingEnabled ).toBe( true );
		controller.activate();
		expect( surface.model.on ).toHaveBeenCalledWith( 'select', expect.any( Function ) );
	} );

	it( 'should stay disabled and not bind select when the user preference is off', () => {
		const origGet = mw.user.options.get;
		mw.user.options.get = jest.fn().mockReturnValue( '{"bracketMatching":false}' );
		try {
			const disabled = new CodeMirrorVisualEditorHighlight( getMockSurface( '{{Foo}}' ), langSupport );
			expect( disabled.bracketMatchingEnabled ).toBe( false );
			disabled.activate();
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
		expect( themed.syntaxHighlightingEnabled ).toBe( false );
		themed.activate();
		// The refresh listeners are never bound...
		expect( themed.surface.$scrollListener.on ).not.toHaveBeenCalled();
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
