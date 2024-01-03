const { EditorView } = require( '@codemirror/view' );
const CodeMirror = require( '../../src/codemirror.js' ).default;
const $textarea = $( '<textarea>' ),
	cm = new CodeMirror( $textarea );

describe( 'initialize', () => {
	const initializeWithForm = () => {
		const form = document.createElement( 'form' );
		form.append( cm.$textarea[ 0 ] );
		cm.$textarea[ 0 ].form.addEventListener = jest.fn();
		cm.initialize();
	};

	it( 'should create the EditorState with the value of the textarea', () => {
		cm.$textarea.val( 'foobar' );
		cm.$textarea.textSelection = jest.fn().mockReturnValue( 'foobar' );
		cm.initialize();
		expect( cm.view.state.doc.toString() ).toStrictEqual( 'foobar' );
	} );

	it( 'should instantiate an EditorView and add .cm-editor to the DOM', () => {
		initializeWithForm();
		expect( cm.view ).toBeInstanceOf( EditorView );
		expect( cm.view.dom ).toBeInstanceOf( HTMLDivElement );
		expect( cm.$textarea[ 0 ].nextSibling ).toStrictEqual( cm.view.dom );
	} );

	it( 'should hide the native textarea', () => {
		cm.initialize();
		expect( cm.$textarea[ 0 ].style.display ).toStrictEqual( 'none' );
	} );

	it( 'should add a listener for form submission', () => {
		initializeWithForm();
		expect( cm.$textarea[ 0 ].form.addEventListener ).toHaveBeenCalledTimes( 1 );
	} );
} );

describe( 'logUsage', () => {
	it( 'should track usage of CodeMirror with the correct data', () => {
		cm.logUsage( {
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
	beforeEach( () => {
		cm.initialize();
	} );

	it( 'should save using the API with the correct value', () => {
		cm.setCodeMirrorPreference( true );
		expect( mw.Api.prototype.saveOption ).toHaveBeenCalledWith( 'usecodemirror', 1 );
		expect( mw.user.options.set ).toHaveBeenCalledWith( 'usecodemirror', 1 );
	} );

	it( 'should not save preferences if the user is not named', () => {
		mw.user.isNamed = jest.fn().mockReturnValue( false );
		cm.setCodeMirrorPreference( true );
		expect( mw.Api.prototype.saveOption ).toHaveBeenCalledTimes( 0 );
		expect( mw.user.options.set ).toHaveBeenCalledTimes( 0 );
	} );
} );