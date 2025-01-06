/* eslint-disable-next-line n/no-missing-require */
const { EditorState, EditorView, Prec } = require( 'ext.CodeMirror.v6.lib' );
const CodeMirror = require( '../../resources/codemirror.js' );

let textarea, cm, form;
beforeEach( () => {
	form = document.createElement( 'form' );
	textarea = document.createElement( 'textarea' );
	textarea.value = 'Metallica';
	textarea.selectionStart = textarea.selectionEnd = 0;
	form.appendChild( textarea );
	document.body.appendChild( form );
	cm = new CodeMirror( textarea );
} );

describe( 'initialize', () => {
	it( 'should create the EditorState with the value of the textarea', () => {
		cm.textarea.value = 'foobar';
		cm.$textarea.textSelection = jest.fn().mockReturnValue( 'foobar' );
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
		expect( cm.state ).toBeInstanceOf( EditorState );
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

	it( "should copy the 'dir' and 'lang' attributes of the textarea to .cm-editor", () => {
		cm.$textarea.prop( 'dir', 'rtl' )
			.prop( 'lang', 'ar' );
		cm.initialize();
		expect( cm.view.dom.getAttribute( 'dir' ) ).toStrictEqual( 'rtl' );
		expect( cm.view.dom.getAttribute( 'lang' ) ).toStrictEqual( 'ar' );
	} );

	it( 'should be readonly when the textarea is also readonly', () => {
		textarea.readOnly = true;
		// This test requires a fresh instantiation.
		cm = new CodeMirror( textarea );
		cm.initialize();
		expect( cm.readOnly ).toEqual( true );
		expect( cm.state.readOnly ).toEqual( true );
	} );

	it( 'should not allow initialization more than once', () => {
		const spy = jest.spyOn( mw.log, 'warn' );
		cm.initialize();
		expect( spy ).toHaveBeenCalledTimes( 0 );
		cm.initialize();
		expect( spy ).toHaveBeenCalledTimes( 1 );
		expect( spy ).toHaveBeenCalledWith( '[CodeMirror] CodeMirror instance already initialized.' );
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
	it( 'should persist the view but not the state', () => {
		cm.initialize();
		expect( cm.view ).not.toBeNull();
		expect( cm.state ).not.toBeNull();
		cm.toggle();
		expect( cm.view ).not.toBeNull();
		expect( cm.state ).toBeNull();
		cm.toggle();
		expect( cm.view ).not.toBeNull();
		expect( cm.state ).not.toBeNull();
	} );

	it( 'should hide the editor but maintain the EditorView when toggling', () => {
		cm.initialize();
		const oldView = cm.view;
		const oldState = cm.view.state;
		cm.toggle();
		expect( cm.state ).toBeNull();
		expect( cm.container.classList ).toContain( 'ext-codemirror-wrapper--hidden' );
		cm.toggle();
		expect( cm.view ).toBe( oldView );
		expect( cm.view.state ).not.toBe( oldState );
		expect( cm.container.classList ).not.toContain( 'ext-codemirror-wrapper--hidden' );
	} );

	it( 'should call activate() or deactivate() accordingly', () => {
		cm.initialize( false );
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
		mw.hook.mockHooks = {};
		cm.initialize();
		expect( mw.hook.mockHooks[ 'editRecovery.loadEnd' ] ).toHaveLength( 1 );
		const initializeSpy = jest.spyOn( cm, 'initialize' );
		cm.toggle();
		expect( initializeSpy ).toHaveBeenCalledTimes( 0 );
		expect( mw.hook.mockHooks[ 'editRecovery.loadEnd' ] ).toHaveLength( 1 );
	} );

	it( 'should retain extensions when toggling', () => {
		const numExtensions = cm.defaultExtensions.length;
		cm.toggle( true );
		expect( cm.initExtensions ).toHaveLength( numExtensions );
		cm.toggle( false );
		expect( cm.initExtensions ).toHaveLength( numExtensions );
		cm.toggle( true );
		expect( cm.initExtensions ).toHaveLength( numExtensions );
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

describe( 'logUsage', () => {
	it( 'should track usage of CodeMirror with the correct data', () => {
		CodeMirror.logUsage( {
			editor: 'wikitext',
			enabled: true,
			toggled: false
		} );
		expect( mw.track ).toBeCalledWith( 'event.CodeMirrorUsage', {
			editor: 'wikitext',
			enabled: true,
			// eslint-disable-next-line camelcase
			session_token: 'abc',
			toggled: false,
			// eslint-disable-next-line camelcase
			user_edit_count_bucket: '1000+ edits',
			// eslint-disable-next-line camelcase
			user_id: 123
		} );
	} );
} );

describe( 'setCodeMirrorPreference', () => {
	it( 'should save using the API with the correct value', () => {
		CodeMirror.setCodeMirrorPreference( true );
		expect( mw.Api.prototype.saveOption ).toHaveBeenCalledWith( 'usecodemirror', 1 );
		expect( mw.user.options.set ).toHaveBeenCalledWith( 'usecodemirror', 1 );
	} );

	it( 'should not save preferences if the user is not named', () => {
		mw.user.isNamed = jest.fn().mockReturnValue( false );
		CodeMirror.setCodeMirrorPreference( true );
		expect( mw.Api.prototype.saveOption ).toHaveBeenCalledTimes( 0 );
		expect( mw.user.options.set ).toHaveBeenCalledTimes( 0 );
	} );
} );
