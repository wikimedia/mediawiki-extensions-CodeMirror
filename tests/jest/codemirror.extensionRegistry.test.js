/* eslint-disable-next-line n/no-missing-require */
const { Compartment, EditorState, EditorView, Prec } = require( 'ext.CodeMirror.v6.lib' );
const CodeMirrorExtensionRegistry = require( '../../resources/codemirror.extensionRegistry.js' );

describe( 'CodeMirrorExtensionRegistry', () => {
	beforeEach( () => {
		// Suppress console warning about missing compartment/extension.
		jest.spyOn( console, 'warn' ).mockImplementation( () => {} );
	} );

	afterEach( jest.restoreAllMocks );

	function getRegistry( extensions, isVisualEditor = false ) {
		return new CodeMirrorExtensionRegistry( extensions, isVisualEditor );
	}

	it( 'constructor', () => {
		const registry = getRegistry( {
			bracketMatching: EditorView.theme(),
			lineWrapping: EditorView.theme()
		} );
		expect( registry.compartments.bracketMatching ).toBeInstanceOf( Compartment );
		expect( registry.compartments.lineWrapping ).toBeInstanceOf( Compartment );
	} );

	it( 'constructor (VisualEditor)', () => {
		const registry = getRegistry( {
			bracketMatching: EditorView.theme(),
			codeFolding: EditorView.theme()
		}, true );
		expect( registry.compartments.bracketMatching ).toBeInstanceOf( Compartment );
		expect( registry.compartments.codeFolding ).toBeUndefined();
	} );

	it( 'get', () => {
		const bracketMatching = EditorView.theme();
		const registry = getRegistry( { bracketMatching } );
		expect( registry.get( 'bracketMatching' ).constructor.name ).toBe( 'CompartmentInstance' );
		expect( registry.get( 'doesntExist' ) ).toBeUndefined();
	} );

	it( 'get (VisualEditor)', () => {
		const registry = getRegistry( {
			bracketMatching: EditorView.theme(),
			codeFolding: EditorView.theme()
		}, true );
		expect( registry.get( 'bracketMatching' ).constructor.name ).toBe( 'CompartmentInstance' );
		expect( registry.get( 'codeFolding' ) ).toBeUndefined();
	} );

	it( 'getCompartment', () => {
		const registry = getRegistry( { bracketMatching: EditorView.theme() } );
		expect( registry.getCompartment( 'bracketMatching' ) ).toBeInstanceOf( Compartment );
		expect( registry.getCompartment( 'doesntExist' ) ).toBeUndefined();
	} );

	it( 'names', () => {
		const registry = getRegistry( {
			bracketMatching: EditorView.theme(),
			lineWrapping: EditorView.theme()
		} );
		expect( registry.names ).toStrictEqual( [ 'bracketMatching', 'lineWrapping' ] );
	} );

	it( 'register / isRegistered', () => {
		const registry = getRegistry( {} );
		const extension = EditorView.theme();
		const view = new EditorView();
		expect( registry.isRegistered( 'bracketMatching', view ) ).toBeFalsy();
		registry.register( 'bracketMatching', extension, view, true );
		expect( registry.get( 'bracketMatching' ).constructor.name ).toBe( 'CompartmentInstance' );
		expect( registry.get( 'bracketMatching' ).compartment.get( view.state ) ).toBe( extension );
		expect( registry.isRegistered( 'bracketMatching', view ) ).toBeTruthy();
		expect( registry.names ).toStrictEqual( [ 'bracketMatching' ] );
		expect( registry.compartments.bracketMatching.get( view.state ) ).toBe( extension );
		expect( registry.isEnabled( 'bracketMatching', view ) ).toBeTruthy();
		// Re-register and assert it is not overwritten.
		const extension2 = EditorView.theme();
		registry.register( 'bracketMatching', extension2, view, true );
		expect( registry.get( 'bracketMatching' ).compartment.get( view.state ) ).toBe( extension );
		expect( registry.isEnabled( 'bracketMatching', view ) ).toBeTruthy();
		expect( console.warn ).not.toHaveBeenCalled();
	} );

	it( 'reconfigure', () => {
		const registry = getRegistry( {} );
		const view = new EditorView();
		registry.register( 'tabSize', EditorState.tabSize.of( 5 ), view, true );
		expect( registry.isEnabled( 'tabSize', view ) ).toBeTruthy();
		expect( registry.getCompartment( 'tabSize' ).get( view.state ).value ).toBe( 5 );
		const newTabSize = EditorState.tabSize.of( 10 );
		registry.reconfigure( 'tabSize', view, newTabSize );
		expect( registry.isEnabled( 'tabSize', view ) ).toBeTruthy();
		expect( registry.getCompartment( 'tabSize' ).get( view.state ).value ).toBe( 10 );
		expect( console.warn ).not.toHaveBeenCalled();
	} );

	it( 'toggle', () => {
		const registry = getRegistry( {} );
		const bracketMatching = EditorView.theme();
		const view = new EditorView();
		registry.register( 'bracketMatching', bracketMatching, view, false );
		expect( registry.isEnabled( 'bracketMatching', view ) ).toBeFalsy();
		registry.toggle( 'bracketMatching', view );
		expect( registry.isEnabled( 'bracketMatching', view ) ).toBeTruthy();
		expect( registry.getCompartment( 'bracketMatching' ).get( view.state ) ).toBe( bracketMatching );
		registry.toggle( 'bracketMatching', view, true );
		expect( registry.isEnabled( 'bracketMatching', view ) ).toBeTruthy();
		registry.toggle( 'bracketMatching', view );
		expect( registry.isEnabled( 'bracketMatching', view ) ).toBeFalsy();
		expect( console.warn ).not.toHaveBeenCalled();
		// Attempt to enable an unknown extension.
		registry.toggle( 'doesntExist', view, true );
		expect( console.warn ).toHaveBeenCalledWith( '[CodeMirror] Extension "doesntExist" is not registered.' );
	} );

	it( 'isEnabled', () => {
		const registry = getRegistry( {} );
		const precExtension = Prec.high( EditorView.theme() );
		const view = new EditorView();
		registry.register( 'precExtension', precExtension, view, true );
		expect( registry.isEnabled( 'precExtension', view ) ).toBeTruthy();
	} );
} );
