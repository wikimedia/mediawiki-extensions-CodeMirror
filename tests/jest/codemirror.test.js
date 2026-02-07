/* eslint-disable-next-line n/no-missing-require */
const { EditorView, Prec } = require( 'ext.CodeMirror.v6.lib' );
const CodeMirror = require( '../../resources/codemirror.js' );
const { javascript } = require( '../../resources/modes/codemirror.mode.exporter.js' );

let textarea, cm, form;

beforeEach( () => {
	mw.hook.mockHooks = {};
	form = document.createElement( 'form' );
	textarea = document.createElement( 'textarea' );
	textarea.value = 'Metallica';
	form.appendChild( textarea );
	document.body.appendChild( form );
	cm = new CodeMirror( textarea );
	// Suppress console warning about re-initialization, etc.
	jest.spyOn( console, 'warn' ).mockImplementation( () => {} );
} );

afterEach( () => {
	document.body.innerHTML = '';
	jest.restoreAllMocks();
} );

describe( 'initialize', () => {
	it( 'should create the EditorState with the value of the textarea', () => {
		cm.textarea.value = 'foobar';
		cm.initialize();
		expect( cm.view.state.doc.toString() ).toStrictEqual( 'foobar' );
	} );

	it( 'should set the height to the same as the textarea', () => {
		textarea.style.height = '100px';
		cm.initialize();
		// 100 + 6 (padding/border) = 106
		expect( $( cm.view.dom ).outerHeight() ).toStrictEqual( 106 );
	} );

	it( 'should instantiate an EditorView and add .cm-editor to the DOM', () => {
		cm.initialize();
		expect( cm.view ).toBeInstanceOf( EditorView );
		expect( cm.isActive ).toBe( true );
		expect( cm.view.dom ).toBeInstanceOf( HTMLDivElement );
		expect( cm.textarea.nextSibling ).toStrictEqual( cm.view.dom );
	} );

	it( 'should hide the native textarea', () => {
		cm.initialize();
		// The textarea is hidden with CSS via .ext-codemirror-wrapper
		expect( cm.container.className ).toStrictEqual( 'ext-codemirror-wrapper' );
	} );

	it( 'should retain the mw-editfont- class present on the textarea', () => {
		cm.$textarea.addClass( 'mw-editfont-monospace' );
		cm.initialize();
		expect( cm.view.dom.querySelector( '.cm-content' ).classList ).toContain( 'mw-editfont-monospace' );
	} );

	it( 'should not retain mw-editfont- classes for programming languages', () => {
		const cm2 = new CodeMirror( textarea, javascript() );
		cm2.$textarea.addClass( 'mw-editfont-serif' );
		cm2.initialize();
		expect( cm2.view.dom.querySelector( '.cm-content' ).classList ).not.toContain( 'mw-editfont-serif' );
	} );

	it( "should copy the 'dir' and 'lang' attributes of the textarea to .cm-editor", () => {
		cm.$textarea.prop( 'dir', 'rtl' )
			.prop( 'lang', 'ar' );
		cm.initialize();
		expect( cm.view.dom.getAttribute( 'dir' ) ).toStrictEqual( 'rtl' );
		expect( cm.view.dom.getAttribute( 'lang' ) ).toStrictEqual( 'ar' );
	} );

	it( 'should not allow initialization more than once', () => {
		const spy = jest.spyOn( mw.log, 'warn' );
		cm.initialize();
		expect( spy ).toHaveBeenCalledTimes( 0 );
		cm.initialize();
		expect( spy ).toHaveBeenCalledTimes( 1 );
		expect( spy ).toHaveBeenCalledWith( '[CodeMirror] CodeMirror instance already initialized.' );
	} );

	it( 'should register the codeFolding and autocompletion extensions for non-wikitext', () => {
		const cm2 = new CodeMirror( textarea, javascript() );
		cm2.initialize();
		expect( cm2.extensionRegistry.isEnabled( 'autocomplete', cm2.view ) ).toBeTruthy();
		expect( cm2.extensionRegistry.isEnabled( 'codeFolding', cm2.view ) ).toBeTruthy();
	} );

	it( 'should document accessibility keyboard shortcuts for non-wikitext', () => {
		const cm2 = new CodeMirror( textarea, javascript() );
		cm2.initialize();
		expect( Object.keys( cm2.keymap.keymapHelpRegistry.accessibility ) )
			.toStrictEqual( [ 'tabEscape', 'tabMode' ] );
	} );

	it( 'should disable spellcheck for non-wikitext', () => {
		cm.initialize();
		expect( cm.view.contentDOM.getAttribute( 'spellcheck' ) ).toStrictEqual( 'true' );
		const cm2 = new CodeMirror( textarea, javascript() );
		cm2.initialize();
		expect( cm2.view.contentDOM.getAttribute( 'spellcheck' ) ).toStrictEqual( 'false' );
	} );
} );

describe( 'addDarkModeMutationObserver', () => {
	it( 'should apply the oneDark theme when in dark mode for non-wikitext', async () => {
		document.documentElement.classList.add( 'skin-theme-clientpref-os' );
		const cm2 = new CodeMirror( textarea, javascript() );
		const matchMedia = window.matchMedia;
		window.matchMedia = jest.fn().mockImplementation( ( query ) => ( {
			'(prefers-color-scheme: dark)': { matches: true, addEventListener: jest.fn() },
			print: matchMedia( 'print' )
		}[ query ] ) );
		cm2.initialize();
		expect( cm2.extensionRegistry.isEnabled( 'darkMode', cm2.view ) ).toBeTruthy();
		document.documentElement.classList.remove( 'skin-theme-clientpref-os' );
		document.documentElement.classList.add( 'skin-theme-clientpref-day' );
		await new Promise( process.nextTick );
		expect( cm2.extensionRegistry.isEnabled( 'darkMode', cm2.view ) ).toBeFalsy();
	} );
} );

describe( 'applyExtension', () => {
	it( 'should apply the given Extension', () => {
		cm.initialize();
		expect( cm.view.contentDOM.getAttribute( 'spellcheck' ) ).toStrictEqual( 'true' );
		cm.applyExtension( Prec.high( EditorView.contentAttributes.of( {
			spellcheck: 'false'
		} ) ) );
		expect( cm.view.contentDOM.getAttribute( 'spellcheck' ) ).toStrictEqual( 'false' );
	} );
} );

describe( 'toggle', () => {
	it( 'should persist the view', () => {
		cm.initialize();
		expect( cm.view ).not.toBeNull();
		expect( cm.isActive ).toBe( true );
		cm.toggle();
		expect( cm.view ).not.toBeNull();
		expect( cm.isActive ).toBe( false );
		cm.toggle();
		expect( cm.view ).not.toBeNull();
		expect( cm.isActive ).toBe( true );
	} );

	it( 'should hide the editor but maintain the EditorView when toggling', () => {
		cm.initialize();
		const oldView = cm.view;
		const oldState = cm.view.state;
		cm.toggle();
		expect( cm.isActive ).toBe( false );
		expect( cm.container.classList ).toContain( 'ext-codemirror-wrapper--hidden' );
		cm.toggle();
		expect( cm.view ).toBe( oldView );
		expect( cm.view.state ).not.toBe( oldState );
		expect( cm.container.classList ).not.toContain( 'ext-codemirror-wrapper--hidden' );
	} );

	it( 'should call activate() or deactivate() accordingly', () => {
		cm.initialize();
		const activateSpy = jest.spyOn( cm, 'activate' );
		const deactivateSpy = jest.spyOn( cm, 'deactivate' );
		cm.toggle( true );
		expect( activateSpy ).toHaveBeenCalledTimes( 1 );
		expect( deactivateSpy ).toHaveBeenCalledTimes( 0 );
		cm.toggle( false );
		expect( activateSpy ).toHaveBeenCalledTimes( 1 );
		expect( deactivateSpy ).toHaveBeenCalledTimes( 1 );
		cm.toggle();
		expect( activateSpy ).toHaveBeenCalledTimes( 2 );
		expect( deactivateSpy ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'should not call initialize more than once', () => {
		cm.initialize();
		expect( mw.hook.mockHooks[ 'editRecovery.loadEnd' ] ).toHaveLength( 1 );
		const initializeSpy = jest.spyOn( cm, 'initialize' );
		cm.toggle();
		expect( initializeSpy ).toHaveBeenCalledTimes( 0 );
		expect( mw.hook.mockHooks[ 'editRecovery.loadEnd' ] ).toHaveLength( 1 );
	} );

	it( 'should fire the toggle hook only when the active state changed', () => {
		mw.hook( 'ext.CodeMirror.toggle' ).add( () => {
			expect( true ).toBe( true );
		} );
		cm.initialize();
		expect.assertions( 1 );
		cm.toggle( true );
		expect.assertions( 1 );
		cm.toggle();
		expect.assertions( 2 );
	} );

	it( 'should put focus on the editor if the autofocus preference is set', () => {
		// Autofocus is on by default.
		cm.initialize();
		expect( document.activeElement ).toBe( cm.view.contentDOM );
		cm.toggle();
		document.activeElement.blur();
		cm.toggle();
		expect( document.activeElement ).toBe( cm.view.contentDOM );
		// Disable the preference and re-test.
		cm.preferences.setPreference( 'autofocus', false );
		cm.toggle();
		document.activeElement.blur();
		cm.toggle();
		expect( document.activeElement ).not.toBe( cm.view.contentDOM );
	} );
} );

describe( 'activate', () => {
	it( 'should return early if already activated', () => {
		const spy = jest.spyOn( mw.log, 'warn' );
		// initialize() also calls activate()
		cm.initialize();
		cm.activate();
		expect( spy ).toHaveBeenCalledTimes( 1 );
		expect( spy ).toHaveBeenCalledWith( '[CodeMirror] CodeMirror instance already active.' );
	} );

	it( 'should sync contents from the original textarea', () => {
		cm.initialize();
		cm.deactivate();
		cm.textarea.value = 'activate - sync contents';
		cm.activate();
		expect( cm.view.state.doc.toString() ).toStrictEqual( 'activate - sync contents' );
	} );
} );

describe( 'deactivate', () => {
	it( 'should return early if not active', () => {
		const spy = jest.spyOn( mw.log, 'warn' );
		cm.deactivate();
		expect( spy ).toHaveBeenCalledTimes( 1 );
		expect( spy ).toHaveBeenCalledWith( '[CodeMirror] CodeMirror instance is not active.' );
	} );

	it( 'should re-show the native textarea', () => {
		cm.initialize();
		expect( cm.container.className ).toStrictEqual( 'ext-codemirror-wrapper' );
		cm.deactivate();
		// .ext-codemirror-wrapper--hidden hides the .cm-editor element, and shows the textarea.
		expect( cm.container.className ).toStrictEqual(
			'ext-codemirror-wrapper ext-codemirror-wrapper--hidden'
		);
	} );
} );

describe( 'destroy', () => {
	it( 'should remove the form submit event listener', () => {
		const events = {};
		form.addEventListener = jest.fn( ( event, callback ) => {
			events[ event ] = callback;
		} );
		form.removeEventListener = jest.fn( ( event ) => {
			delete events[ event ];
		} );

		cm.initialize();
		expect( typeof cm.formSubmitEventHandler ).toBe( 'function' );
		expect( events.submit ).toBe( cm.formSubmitEventHandler );
		cm.destroy();
		expect( cm.formSubmitEventHandler ).toBeNull();
		expect( events.submit ).toBeUndefined();
	} );
} );

describe( 'form submission', () => {
	it( 'should sync contents back to the textarea on submission', () => {
		// From fixture in beforeEach
		expect( cm.textarea.value ).toStrictEqual( 'Metallica' );
		expect( cm.view ).toBeNull();
		cm.initialize();
		expect( cm.view ).toBeInstanceOf( EditorView );
		cm.textSelection.setContents( 'This is a test' );
		form.dispatchEvent( new Event( 'submit' ) );
		expect( cm.textarea.value ).toStrictEqual( 'This is a test' );
		expect( cm.view.state.doc.toString() ).toStrictEqual( 'This is a test' );
	} );

	it( 'should not intercept form submission when CodeMirror is deactivated', () => {
		cm.initialize();
		expect( textarea.value ).toStrictEqual( 'Metallica' );
		expect( cm.view.state.doc.toString() ).toStrictEqual( 'Metallica' );
		cm.deactivate();
		textarea.value = 'Pantera';
		form.dispatchEvent( new Event( 'submit' ) );
		expect( cm.view.state.doc.toString() ).toStrictEqual( 'Metallica' );
		expect( textarea.value ).toStrictEqual( 'Pantera' );
	} );
} );

describe( 'multiple instances', () => {
	describe( 'jQuery valHooks', () => {
		it( 'should route to the correct CodeMirror instance', () => {
			// cm already defined in beforeEach, let's add a second instance
			const textarea2 = document.createElement( 'textarea' );
			textarea2.value = 'Pantera';
			form.appendChild( textarea2 );
			const cm2 = new CodeMirror( textarea2 );

			// Initialize both instances
			cm.initialize();
			cm2.initialize();

			// Set values for using .val()
			cm.$textarea.val( 'Soundgarden' );
			cm2.$textarea.val( 'Alice in Chains' );

			// Test the values
			expect( cm.view.state.doc.toString() ).toStrictEqual( 'Soundgarden' );
			expect( cm2.view.state.doc.toString() ).toStrictEqual( 'Alice in Chains' );
		} );

		it( 'should remain working even if other instances are destroyed', () => {
			const textarea2 = document.createElement( 'textarea' );
			textarea2.value = 'Pantera';
			form.appendChild( textarea2 );
			const cm2 = new CodeMirror( textarea2 );

			// Initialize both instances
			cm.initialize();
			cm2.initialize();

			expect( cm2.view.state.doc.toString() ).toStrictEqual( 'Pantera' );

			// Destroy the first instance
			cm.destroy();

			// .val() on the second instance should still work.
			cm2.$textarea.val( 'Alice in Chains' );
			expect( cm2.view.state.doc.toString() ).toStrictEqual( 'Alice in Chains' );

			// And the first instance should work as it did prior to initialization.
			cm.$textarea.val( 'Soundgarden' );
			expect( cm.textarea.value ).toStrictEqual( 'Soundgarden' );
		} );
	} );
} );

describe( 'addMwHook', () => {
	it( 'should not add the same handler to a hook twice', () => {
		const fn = () => {};
		cm.addMwHook( 'ext.CodeMirror.ready', fn );
		cm.addMwHook( 'ext.CodeMirror.ready', fn );
		expect( mw.hook.mockHooks[ 'ext.CodeMirror.ready' ].length ).toBe( 1 );
	} );

	it( 'should remove handlers when deactivating', () => {
		cm.initialize();
		const fn1 = () => {};
		const fn2 = () => {};
		cm.addMwHook( 'ext.CodeMirror.ready', fn1 );
		cm.addMwHook( 'ext.CodeMirror.preferences.ready', fn2 );
		expect( mw.hook.mockHooks[ 'ext.CodeMirror.ready' ] ).toContain( fn1 );
		expect( mw.hook.mockHooks[ 'ext.CodeMirror.preferences.ready' ] ).toContain( fn2 );
		cm.deactivate();
		expect( mw.hook.mockHooks[ 'ext.CodeMirror.ready' ] ).not.toContain( fn1 );
		expect( mw.hook.mockHooks[ 'ext.CodeMirror.preferences.ready' ] ).not.toContain( fn2 );
	} );
} );

describe( 'setCodeMirrorPreference', () => {
	it( 'should save using the API with the correct value', () => {
		mw.user.isNamed = jest.fn().mockReturnValue( true );
		mw.user.options.get = jest.fn().mockReturnValue( 0 );
		CodeMirror.setCodeMirrorPreference( true );
		expect( mw.Api.prototype.saveOption ).toHaveBeenCalledWith( 'usecodemirror', 1 );
		expect( mw.user.options.set ).toHaveBeenCalledWith( 'usecodemirror', 1 );
	} );

	it( 'should not save if the user is not named', () => {
		mw.user.isNamed = jest.fn().mockReturnValue( false );
		mw.user.options.get = jest.fn().mockReturnValue( 0 );
		CodeMirror.setCodeMirrorPreference( true );
		expect( mw.Api.prototype.saveOption ).toHaveBeenCalledTimes( 0 );
		expect( mw.user.options.set ).toHaveBeenCalledTimes( 0 );
	} );

	it( 'should not save if the preference hasn\'t changed', () => {
		mw.user.isNamed = jest.fn().mockReturnValue( true );
		mw.user.options.get = jest.fn().mockReturnValue( 0 );
		CodeMirror.setCodeMirrorPreference( true );
		expect( mw.Api.prototype.saveOption ).toHaveBeenCalledWith( 'usecodemirror', 1 );
		expect( mw.user.options.set ).toHaveBeenCalledWith( 'usecodemirror', 1 );
		mw.user.options.get = jest.fn().mockReturnValue( 1 );
		CodeMirror.setCodeMirrorPreference( true );
		expect( mw.Api.prototype.saveOption ).toHaveBeenCalledTimes( 1 );
		expect( mw.user.options.set ).toHaveBeenCalledTimes( 1 );
	} );
} );

describe( 'readonly', () => {
	beforeEach( () => {
		textarea.readOnly = true;
		// These test require a fresh instantiation.
		cm = new CodeMirror( textarea );
		cm.initialize();
	} );

	it( 'should be readonly when the textarea is also readonly', () => {
		expect( cm.readOnly ).toEqual( true );
		expect( cm.view.state.readOnly ).toEqual( true );
	} );

	it( 'should prevent transactions that make document changes from being dispatched', () => {
		expect( cm.view.state.doc.toString() ).toEqual( 'Metallica' );
		const transaction = cm.view.state.update( {
			changes: { from: 0, to: 0, insert: 'foo' }
		} );
		cm.view.dispatch( transaction );
		expect( cm.view.state.doc.toString() ).toEqual( 'Metallica' );
	} );
} );

describe( 'domEventHandlersExtension', () => {
	const testCases = [
		{ eventName: 'blur', eventConstructor: FocusEvent },
		{ eventName: 'focus', eventConstructor: FocusEvent, assertions: 2 },
		{ eventName: 'keyup', eventConstructor: KeyboardEvent },
		{ eventName: 'keydown', eventConstructor: KeyboardEvent },
		{ eventName: 'scroll', eventConstructor: Event, target: 'scrollDOM' }
	];

	it.each( testCases )( 'should bubble $eventName events to the original textarea',
		( { eventName, eventConstructor, target = 'contentDOM', assertions = 1 } ) => {
			textarea.addEventListener( eventName, () => {
				expect( true ).toBe( true );
			} );
			cm.initialize();
			// eslint-disable-next-line new-cap
			const dispatchedEvent = new eventConstructor( eventName );
			cm.view[ target ].dispatchEvent( dispatchedEvent );
			expect.assertions( assertions );
		}
	);
} );
