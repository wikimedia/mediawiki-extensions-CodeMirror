/* eslint-disable-next-line n/no-missing-require */
const { EditorState, EditorView } = require( 'ext.CodeMirror.lib' );
const CodeMirrorVisualEditor = require( '../../resources/visualEditor/codemirror.visualEditor.js' );

/**
 * Build a mock ve.ui.Surface. getView() and getModel() return stable objects, so that
 * listeners bound during activate() are the same ones deactivate() detaches, and so
 * tests can assert on identity.
 *
 * Source-offset mapping is stubbed as the identity function, making DM offsets and
 * source offsets interchangeable.
 *
 * @param {boolean} [readOnly]
 * @param {string} [targetName] Constructor name of the VE target, e.g. 'CommentTarget'
 * @return {Object}
 */
const getMockSurface = ( readOnly = false, targetName = 'article' ) => {
	// Parented, as VisualEditor builds it: addToDOM() wraps the attached root in place, so
	// it needs somewhere to put the wrapper.
	const $surface = $( '<div>' ).addClass( 've-ce-surface' );
	const $attachedRootNode = $( '<div>' ).css( 'padding', '10px' ).appendTo( $surface );
	const surfaceView = {
		$attachedRootNode: $attachedRootNode,
		// VisualEditor's own deprecated alias for the same element.
		$documentNode: $attachedRootNode,
		$element: $surface,
		getDocument: jest.fn().mockReturnValue( {
			getDir: jest.fn().mockReturnValue( 'ltr' )
		} ),
		focus: jest.fn(),
		isFocused: jest.fn().mockReturnValue( true ),
		on: jest.fn(),
		off: jest.fn()
	};
	const model = {
		isReadOnly: jest.fn().mockReturnValue( readOnly ),
		getDocument: jest.fn().mockReturnValue( {
			on: jest.fn(),
			off: jest.fn(),
			getStore: jest.fn().mockReturnValue( {} )
		} ),
		on: jest.fn(),
		off: jest.fn(),
		getSourceOffsetFromOffset: jest.fn().mockImplementation( ( offset ) => offset )
	};
	return {
		getView: jest.fn().mockReturnValue( surfaceView ),
		getModel: jest.fn().mockReturnValue( model ),
		getMode: jest.fn().mockReturnValue( 'source' ),
		getDom: jest.fn().mockReturnValue( '' ),
		getTarget: jest.fn().mockReturnValue( {
			constructor: { name: targetName },
			// As VisualEditor builds it. The wrapper is a separate element addToDOM() makes,
			// so a mock that puts that class here would hide whether it was ever created.
			$element: $( '<div>' ).addClass( 've-init-target' )
		} )
	};
};
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
	it( 'should bind to the ve.ui.Surface, aliased as both textarea and surface', () => {
		expect( cmVe.surface ).toBe( surface );
		expect( cmVe.textarea ).toBe( surface );
		expect( cmVe.$textarea[ 0 ] ).toBe( surface );
		expect( cmVe.surfaceView ).toBe( surface.getView() );
	} );

	it( 'should go by the VE model for the read-only state', () => {
		surface = getMockSurface( true );
		cmVe = new CodeMirrorVisualEditor( surface );
		expect( cmVe.readOnly ).toStrictEqual( true );
		cmVe.initialize();
		expect( cmVe.view.state.readOnly ).toStrictEqual( true );
	} );

	it( 'should only seed the registry with VE-supported extensions', () => {
		expect( Object.keys( cmVe.extensionRegistryDefaults ) ).toStrictEqual( [
			'activeLine',
			'bracketMatching',
			'lineNumbering',
			'trailingWhitespace',
			'whitespace'
		] );
	} );
} );

describe( 'supportedPreferences', () => {
	it( 'should be the registry contents, before and after initialization', () => {
		// No language support here, so the mode cannot resolve links and openLinks is absent.
		expect( cmVe.supportedPreferences ).toStrictEqual( [
			'activeLine',
			'bracketMatching',
			'lineNumbering',
			'trailingWhitespace',
			'whitespace'
		] );
		cmVe.initialize();
		// initialize() adds the theme, which CodeMirrorThemes registers once there's a view.
		expect( cmVe.supportedPreferences ).toStrictEqual( [
			'activeLine',
			'bracketMatching',
			'lineNumbering',
			'trailingWhitespace',
			'whitespace',
			'theme'
		] );
	} );

	it( 'should not gain the preferences disabled by the VE language support config', () => {
		const { mediawiki } = require( '../../resources/modes/mediawiki/codemirror.mediawiki.js' );
		// The same config ve.ui.CodeMirrorAction passes.
		const langSupport = mediawiki( {
			bidiIsolation: false,
			codeFolding: false,
			foldAllRefs: false,
			autocomplete: false,
			openLinks: false,
			closeTags: false,
			lint: false
		} );
		cmVe = new CodeMirrorVisualEditor( getMockSurface(), langSupport );
		cmVe.initialize();
		// highlightRefs is registered by the mediawiki mode's ready handler, and is wanted.
		expect( cmVe.supportedPreferences ).toContain( 'highlightRefs' );
		// openLinks is absent from this list on purpose: the mode's own extension is off, but
		// this integration seeds a preference of the same name for its own mark.
		expect( cmVe.supportedPreferences ).toContain( 'openLinks' );
		// These would otherwise be registered after construction, bypassing the defaults.
		for ( const name of [
			'lint', 'closeTags', 'codeFolding', 'autocomplete',
			'bidiIsolation', 'foldAllRefs', 'autofocus', 'closeBrackets',
			'lineWrapping', 'specialChars'
		] ) {
			expect( cmVe.supportedPreferences ).not.toContain( name );
		}
	} );
} );

describe( 'supportedExtensions', () => {
	beforeEach( () => {
		jest.spyOn( console, 'warn' ).mockImplementation( () => {} );
	} );

	afterEach( jest.restoreAllMocks );

	it( 'should be the extensions that can underlay the VE surface', () => {
		expect( cmVe.supportedExtensions ).toStrictEqual( [
			'activeLine',
			'bracketMatching',
			'highlightRefs',
			'lineNumbering',
			'openLinks',
			'theme',
			'trailingWhitespace',
			'whitespace'
		] );
	} );

	it( 'should refuse extensions registered after initialization', () => {
		cmVe.initialize();
		// A gadget registering directly, and through CodeMirrorPreferences.
		cmVe.extensionRegistry.register(
			'gadgetThing', EditorState.tabSize.of( 5 ), cmVe.view, true
		);
		cmVe.preferences.registerExtension( 'gadgetPref', EditorView.theme(), cmVe.view );
		// A gadget adding a linter, which registers 'lint' whatever the mode config says.
		cmVe.applyLinter( /foo/g, () => ( { severity: 'error', message: 'nope' } ) );

		for ( const name of [ 'gadgetThing', 'gadgetPref', 'lint' ] ) {
			expect( cmVe.extensionRegistry.isRegistered( name, cmVe.view ) ).toBeFalsy();
			expect( cmVe.supportedPreferences ).not.toContain( name );
		}
	} );

	it( 'should still accept the extensions registered by the language pack', () => {
		cmVe.initialize();
		cmVe.preferences.registerExtension( 'highlightRefs', EditorView.theme(), cmVe.view );
		expect( cmVe.extensionRegistry.isRegistered( 'highlightRefs', cmVe.view ) ).toBe( true );
		expect( console.warn ).not.toHaveBeenCalled();
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

	it( 'should not offer line numbering in DiscussionTools', () => {
		surface = getMockSurface( false, 'CommentTarget' );
		cmVe = new CodeMirrorVisualEditor( surface );
		// Absent from the registry entirely, so the preferences tool won't list it.
		expect( cmVe.extensionRegistryDefaults.lineNumbering ).toBeUndefined();
		expect( cmVe.supportedPreferences ).not.toContain( 'lineNumbering' );
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

	it( 'should refocus the attached root, which wrapping it blurs', () => {
		// addToDOM() moves the attached root into the wrapper, and moving a focused element
		// blurs it. The base restores focus, but only if it saw the element as focused, so
		// it has to go by wrappedElement rather than the surface.
		const attachedRoot = cmVe.surfaceView.$attachedRootNode[ 0 ];
		attachedRoot.setAttribute( 'contenteditable', 'true' );
		attachedRoot.tabIndex = 0;
		document.body.appendChild( cmVe.surfaceView.$element[ 0 ] );
		attachedRoot.focus();
		expect( document.activeElement ).toBe( attachedRoot );

		const spy = jest.spyOn( cmVe.surfaceView, 'focus' );
		cmVe.initialize();
		expect( document.activeElement ).not.toBe( attachedRoot );
		expect( spy ).toHaveBeenCalled();
	} );

	it( 'should bail in non-source mode', () => {
		const spy = jest.spyOn( mw.log, 'warn' ).mockImplementation( () => {} );
		surface.getMode.mockReturnValue( 'visual' );
		cmVe = new CodeMirrorVisualEditor( surface );
		cmVe.initialize();
		expect( cmVe.view ).toBeNull();
		expect( spy ).toHaveBeenCalledWith(
			'[CodeMirror] Attempted to initialize CodeMirrorVisualEditor in non-source mode.'
		);
	} );
} );

describe( 'wrappedElement', () => {
	it( 'should be the attached root, not the surface', () => {
		expect( cmVe.wrappedElement ).toBe( cmVe.surfaceView.$attachedRootNode[ 0 ] );
	} );
} );

describe( 'addToDOM', () => {
	it( 'should wrap the attached root, which becomes the container', () => {
		const attachedRoot = cmVe.surfaceView.$attachedRootNode[ 0 ];
		const parentBefore = attachedRoot.parentNode;
		cmVe.initialize();
		expect( cmVe.container.classList ).toContain( 'ext-codemirror-wrapper' );
		expect( attachedRoot.parentNode ).toBe( cmVe.container );
		expect( cmVe.container.parentNode ).toBe( parentBefore );
	} );

	it( 'should put the view beside the attached root, never inside it', () => {
		// Both halves matter. VisualEditor reconciles away foreign nodes in its own subtree,
		// and codemirror.visualEditor.less hides that subtree's text, which would take the
		// overlay with it: -webkit-text-fill-color inherits, and opacity cannot be undone
		// on a descendant.
		cmVe.initialize();
		expect( cmVe.view.dom.parentNode ).toBe( cmVe.container );
		expect( cmVe.surfaceView.$attachedRootNode[ 0 ].contains( cmVe.view.dom ) ).toBe( false );
	} );
} );

describe( 'destroy', () => {
	it( 'should take the wrapper back off the attached root', () => {
		const attachedRoot = cmVe.surfaceView.$attachedRootNode[ 0 ];
		const parentBefore = attachedRoot.parentNode;
		cmVe.initialize();
		expect( attachedRoot.parentNode ).not.toBe( parentBefore );
		cmVe.destroy();
		// Restored, so a second initialization does not nest another wrapper.
		expect( attachedRoot.parentNode ).toBe( parentBefore );
	} );
} );

describe( 'getSourceContents', () => {
	it( 'should read the document from the surface', () => {
		surface.getDom.mockReturnValue( 'foo bar' );
		expect( cmVe.getSourceContents() ).toBe( 'foo bar' );
		cmVe.initialize();
		expect( cmVe.view.state.doc.toString() ).toBe( 'foo bar' );
	} );
} );

describe( 'hasFocus', () => {
	it( 'should defer to the VE surface, as a getter and not a method', () => {
		cmVe.surfaceView.isFocused.mockReturnValue( true );
		expect( cmVe.hasFocus ).toBe( true );
		cmVe.surfaceView.isFocused.mockReturnValue( false );
		expect( cmVe.hasFocus ).toBe( false );
	} );

	it( 'should not restore focus on deactivation when the surface is unfocused', () => {
		cmVe.initialize();
		cmVe.surfaceView.isFocused.mockReturnValue( false );
		const spy = jest.spyOn( cmVe, 'focus' );
		cmVe.deactivate();
		expect( spy ).not.toHaveBeenCalled();
	} );
} );

describe( 'source syncing', () => {
	it( 'should leave the surface untouched, as VE owns the document', () => {
		cmVe.initialize();
		const model = surface.getModel();
		expect( cmVe.syncEditorContentsToSource() ).toBeUndefined();
		expect( cmVe.syncSelectionAndScrollPosition( 0, 1, 0 ) ).toBeUndefined();
		// Deactivation must not write back to the surface either.
		cmVe.deactivate();
		expect( model.getDocument().on ).toHaveBeenCalledWith( 'precommit', expect.any( Function ) );
		expect( surface.getDom ).not.toHaveBeenCalledWith( expect.anything() );
	} );

	it( 'should not restore a selection or scroll position, which VE owns', () => {
		const spy = jest.spyOn( cmVe, 'requestAnimationFrame' );
		cmVe.initialize();
		expect( cmVe.restoreSelectionAndScrollPosition( 1, 2, 3, true ) ).toBeUndefined();
		// The base class schedules the restoration on a frame; VE never does.
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

describe( 'openLinks', () => {
	/**
	 * The MediaWiki mode, which supplies openLinks. Its own extension is off, as
	 * ve.ui.CodeMirrorAction turns it off: only the resolver is wanted here.
	 *
	 * @return {Object}
	 */
	const langSupportWithLinks = () => {
		const { mediawiki } =
			require( '../../resources/modes/mediawiki/codemirror.mediawiki.js' );
		return mediawiki( {
			bidiIsolation: false, codeFolding: false, autocomplete: false, openLinks: false
		} );
	};

	/**
	 * A controller over a document with a link in it, at source offsets 2 to 5.
	 *
	 * @param {Object} [langSupport]
	 * @return {CodeMirrorVisualEditor}
	 */
	const newController = ( langSupport = langSupportWithLinks() ) => {
		const mockSurface = getMockSurface();
		mockSurface.getDom = jest.fn().mockReturnValue( '[[Foo]]' );
		return new CodeMirrorVisualEditor( mockSurface, langSupport );
	};

	it( 'should leave the handler unbuilt when the mode supplies no resolver', () => {
		// The default mock passes no language support, so the mode cannot resolve links and
		// the preference is not offered at all.
		expect( cmVe.openLinks ).toBeNull();
		expect( cmVe.openLinksEnabled ).toBe( false );
	} );

	it( 'should offer the preference once the resolver is supplied', () => {
		const c = newController();
		expect( c.openLinks ).not.toBeNull();
		// On by default, as in the non-VE editor.
		expect( c.openLinksEnabled ).toBe( true );
		expect( c.supportedPreferences ).toContain( 'openLinks' );
	} );

	it( 'should honour a stored preference of off', () => {
		mockUserOptionsGet( {
			'codemirror-preferences': JSON.stringify( { openLinks: false } )
		} );
		expect( newController().openLinksEnabled ).toBe( false );
		mockUserOptionsGet();
	} );

	it( 'should enable the handler on activate and disable it on deactivate', () => {
		const c = newController();
		const spy = jest.spyOn( c.openLinks, 'setEnabled' );
		c.initialize();
		expect( spy ).toHaveBeenCalledWith( true );
		c.deactivate();
		expect( spy ).toHaveBeenLastCalledWith( false );
	} );

	it( 'should toggle the mark through the registry and the handler alongside it', () => {
		// The registry owns the decoration; opening a link is VisualEditor's own event, so
		// the handler has to be told separately.
		const c = newController();
		c.initialize();
		const handlerSpy = jest.spyOn( c.openLinks, 'setEnabled' );
		c.applyPreference( 'openLinks', false );
		expect( c.openLinksEnabled ).toBe( false );
		expect( c.extensionRegistry.isEnabled( 'openLinks', c ) ).toBe( false );
		expect( handlerSpy ).toHaveBeenCalledWith( false );

		c.applyPreference( 'openLinks', true );
		expect( c.extensionRegistry.isEnabled( 'openLinks', c ) ).toBe( true );
		expect( handlerSpy ).toHaveBeenLastCalledWith( true );
	} );

	it( 'should mark the link as a decoration, and unmark it again', () => {
		const c = newController();
		c.initialize();
		expect( c.drawOpenLink( 2, 5 ) ).toBe( true );
		expect( c.view.dom.querySelector( '.cm-mw-ve-openLinkToken' ) ).not.toBeNull();
		c.clearOpenLink();
		expect( c.view.dom.querySelector( '.cm-mw-ve-openLinkToken' ) ).toBeNull();
	} );

	it( 'should nest the mark around the mode\'s token span, not merge into it', () => {
		// ve.ui.CodeMirror.less depends on this: the token declares its own color, so an
		// inherited one from the mark would lose and the rule has to reach the descendant.
		const { mediawiki } =
			require( '../../resources/modes/mediawiki/codemirror.mediawiki.js' );
		mw.Title.newFromText = jest.fn().mockReturnValue( { getUrl: () => '/wiki/Foo' } );
		const mockSurface = getMockSurface();
		mockSurface.getDom = jest.fn().mockReturnValue( '[[Foo]]' );
		const langSupport = mediawiki( {
			bidiIsolation: false, codeFolding: false, autocomplete: false, openLinks: false
		} );
		const c = new CodeMirrorVisualEditor( mockSurface, langSupport );
		c.initialize();
		const link = langSupport.openLinks.resolveLinkAt( c.view.state, 2 );
		expect( c.drawOpenLink( link.from, link.to ) ).toBe( true );
		const mark = c.view.dom.querySelector( '.cm-mw-ve-openLinkToken' );
		const token = mark.querySelector( '.cm-mw-link-pagename' );
		expect( token ).not.toBeNull();
		// And the token carries .cm-mw-pagename, which the mode underlines regardless, so the
		// color rather than the underline is what marks it.
		expect( token.classList ).toContain( 'cm-mw-pagename' );
	} );

	it( 'should refuse to mark an empty range', () => {
		const c = newController();
		c.initialize();
		expect( c.drawOpenLink( 5, 5 ) ).toBe( false );
	} );

	it( 'should draw nothing once the view is gone', () => {
		const c = newController();
		c.initialize();
		c.destroy();
		expect( c.drawOpenLink( 2, 5 ) ).toBe( false );
		// Only asserting that it does not throw.
		c.clearOpenLink();
	} );

	it( 'should destroy the handler with the controller', () => {
		const c = newController();
		c.initialize();
		const spy = jest.spyOn( c.openLinks, 'destroy' );
		c.destroy();
		expect( spy ).toHaveBeenCalled();
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
