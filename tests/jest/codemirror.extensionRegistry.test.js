/* eslint-disable-next-line n/no-missing-require */
const { Compartment, EditorState, EditorView, Prec } = require( 'ext.CodeMirror.lib' );
const CodeMirrorExtensionRegistry = require( '../../resources/codemirror.extensionRegistry.js' );

describe( 'CodeMirrorExtensionRegistry', () => {
	beforeEach( () => {
		// Suppress console warning about missing compartment/extension.
		jest.spyOn( console, 'warn' ).mockImplementation( () => {} );
	} );

	afterEach( jest.restoreAllMocks );

	function getRegistry( extensions, supportedExtensions ) {
		return new CodeMirrorExtensionRegistry( extensions, supportedExtensions );
	}

	it( 'constructor', () => {
		const registry = getRegistry( {
			bracketMatching: EditorView.theme(),
			lineWrapping: EditorView.theme()
		} );
		expect( registry.compartments.bracketMatching ).toBeInstanceOf( Compartment );
		expect( registry.compartments.lineWrapping ).toBeInstanceOf( Compartment );
	} );

	it( 'get', () => {
		const bracketMatching = EditorView.theme();
		const registry = getRegistry( { bracketMatching } );
		expect( registry.get( 'bracketMatching' ).constructor.name ).toBe( 'CompartmentInstance' );
		expect( registry.get( 'doesntExist' ) ).toBeUndefined();
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

	describe( 'supportedExtensions', () => {
		it( 'should accept any name when unrestricted', () => {
			const registry = getRegistry( {} );
			const view = new EditorView();
			registry.register( 'tabSize', EditorState.tabSize.of( 5 ), view, true );
			expect( registry.isRegistered( 'tabSize', view ) ).toBeTruthy();
			expect( console.warn ).not.toHaveBeenCalled();
		} );

		it( 'should refuse names outside the allowlist', () => {
			const registry = getRegistry( {}, [ 'bracketMatching' ] );
			const view = new EditorView();
			registry.register( 'tabSize', EditorState.tabSize.of( 5 ), view, true );
			expect( registry.isRegistered( 'tabSize', view ) ).toBeFalsy();
			expect( registry.isEnabled( 'tabSize', view ) ).toBeFalsy();
			expect( registry.names ).toStrictEqual( [] );
			expect( console.warn ).toHaveBeenCalledWith(
				'[CodeMirror] Extension "tabSize" is not supported by this editor.'
			);
		} );

		it( 'should still accept names within the allowlist', () => {
			const registry = getRegistry( {}, [ 'bracketMatching' ] );
			const view = new EditorView();
			registry.register( 'bracketMatching', EditorView.theme(), view, true );
			expect( registry.isRegistered( 'bracketMatching', view ) ).toBeTruthy();
			expect( registry.isEnabled( 'bracketMatching', view ) ).toBeTruthy();
			expect( console.warn ).not.toHaveBeenCalled();
		} );

		it( 'should not apply to the extensions given at construction', () => {
			const registry = getRegistry( { lineWrapping: EditorView.theme() }, [ 'theme' ] );
			expect( registry.names ).toStrictEqual( [ 'lineWrapping' ] );
			expect( registry.getCompartment( 'lineWrapping' ) ).toBeInstanceOf( Compartment );
		} );
	} );

	it( 'registerFromValueMap', () => {
		const registry = getRegistry( {} );
		registry.reconfigValueMap.set( 'tabSize', new Map( [
			[ 'small', EditorState.tabSize.of( 5 ) ],
			[ 'large', EditorState.tabSize.of( 10 ) ]
		] ) );
		const view = new EditorView();
		registry.registerFromValueMap( 'tabSize', view, 'large' );
		expect( registry.getCompartment( 'tabSize' ).get( view.state ).value ).toBe( 10 );
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

	it( 'reconfigValueMap', () => {
		const smallTabSize = EditorState.tabSize.of( 5 );
		const largeTabSize = EditorState.tabSize.of( 10 );
		const registry = getRegistry( {
			tabSize: smallTabSize
		} );
		registry.reconfigValueMap.set( 'tabSize', new Map( [
			[ 'small', smallTabSize ],
			[ 'large', largeTabSize ]
		] ) );
		const view = new EditorView();
		registry.register( 'tabSize', EditorState.tabSize.of( 5 ), view, true );
		expect( registry.getCompartment( 'tabSize' ).get( view.state ).value ).toBe( 5 );
		registry.reconfigureFromValueMap( 'tabSize', view, 'small' );
		expect( registry.getCompartment( 'tabSize' ).get( view.state ).value ).toBe( 5 );
		registry.reconfigureFromValueMap( 'tabSize', view, 'unknown' );
		expect( registry.getCompartment( 'tabSize' ).get( view.state ).value ).toBe( 5 );
		registry.reconfigureFromValueMap( 'tabSize', view, 'large' );
		expect( registry.getCompartment( 'tabSize' ).get( view.state ).value ).toBe( 10 );
		expect( console.warn ).not.toHaveBeenCalled();
	} );
} );

describe( 'CodeMirrorExtensionRegistry (without an EditorView)', () => {
	/**
	 * A stand-in for an EditorView that owns nothing but an EditorState, mirroring what a
	 * headless integration such as CodeMirrorVisualEditorHighlight provides. An EditorState
	 * is immutable, so dispatch() has to store the state the transaction produces.
	 *
	 * @param {string} [doc]
	 * @return {Object}
	 */
	const getHeadlessEditor = ( doc = 'foo' ) => ( {
		state: EditorState.create( { doc } ),
		dispatch( spec ) {
			this.state = this.state.update( spec ).state;
		}
	} );

	beforeEach( () => {
		jest.spyOn( console, 'warn' ).mockImplementation( () => {} );
	} );

	afterEach( jest.restoreAllMocks );

	it( 'should register an extension into a bare EditorState', () => {
		const registry = new CodeMirrorExtensionRegistry( {} );
		const editor = getHeadlessEditor();
		expect( registry.isRegistered( 'tabSize', editor ) ).toBeFalsy();
		registry.register( 'tabSize', EditorState.tabSize.of( 5 ), editor, true );
		expect( registry.isRegistered( 'tabSize', editor ) ).toBe( true );
		expect( registry.isEnabled( 'tabSize', editor ) ).toBe( true );
		expect( editor.state.tabSize ).toBe( 5 );
		expect( console.warn ).not.toHaveBeenCalled();
	} );

	it( 'should register the constructor extensions once the editor is known', () => {
		const registry = new CodeMirrorExtensionRegistry( {
			tabSize: EditorState.tabSize.of( 8 )
		} );
		const editor = getHeadlessEditor();
		// Seeded extensions have a compartment, but are not in the state until included.
		expect( registry.getCompartment( 'tabSize' ) ).toBeInstanceOf( Compartment );
		expect( registry.isRegistered( 'tabSize', editor ) ).toBeFalsy();
		editor.state = EditorState.create( {
			doc: 'foo',
			extensions: registry.get( 'tabSize' )
		} );
		expect( registry.isRegistered( 'tabSize', editor ) ).toBe( true );
		expect( editor.state.tabSize ).toBe( 8 );
	} );

	it( 'should toggle an extension off and on', () => {
		const registry = new CodeMirrorExtensionRegistry( {} );
		const editor = getHeadlessEditor();
		registry.register( 'readOnly', EditorState.readOnly.of( true ), editor, true );
		expect( editor.state.readOnly ).toBe( true );

		registry.toggle( 'readOnly', editor );
		expect( registry.isEnabled( 'readOnly', editor ) ).toBe( false );
		expect( editor.state.readOnly ).toBe( false );
		// Still registered, so it can be turned back on.
		expect( registry.isRegistered( 'readOnly', editor ) ).toBe( true );

		registry.toggle( 'readOnly', editor, true );
		expect( registry.isEnabled( 'readOnly', editor ) ).toBe( true );
		expect( editor.state.readOnly ).toBe( true );
		expect( console.warn ).not.toHaveBeenCalled();
	} );

	it( 'should reconfigure an extension', () => {
		const registry = new CodeMirrorExtensionRegistry( {} );
		const editor = getHeadlessEditor();
		registry.register( 'tabSize', EditorState.tabSize.of( 5 ), editor, true );
		registry.reconfigure( 'tabSize', editor, EditorState.tabSize.of( 10 ) );
		expect( editor.state.tabSize ).toBe( 10 );
	} );

	it( 'should reconfigure from the value map', () => {
		const registry = new CodeMirrorExtensionRegistry( {} );
		const editor = getHeadlessEditor();
		registry.reconfigValueMap.set( 'tabSize', new Map( [
			[ 'small', EditorState.tabSize.of( 2 ) ],
			[ 'large', EditorState.tabSize.of( 12 ) ]
		] ) );
		registry.registerFromValueMap( 'tabSize', editor, 'small' );
		expect( editor.state.tabSize ).toBe( 2 );
		registry.reconfigureFromValueMap( 'tabSize', editor, 'large' );
		expect( editor.state.tabSize ).toBe( 12 );
		// A string passed to toggle() also goes through the value map.
		registry.toggle( 'tabSize', editor, 'small' );
		expect( editor.state.tabSize ).toBe( 2 );
	} );

	it( 'should warn about an unregistered extension, as it does with a view', () => {
		const registry = new CodeMirrorExtensionRegistry( {} );
		const editor = getHeadlessEditor();
		registry.toggle( 'doesntExist', editor, true );
		expect( console.warn ).toHaveBeenCalledWith(
			'[CodeMirror] Extension "doesntExist" is not registered.'
		);
	} );
} );
