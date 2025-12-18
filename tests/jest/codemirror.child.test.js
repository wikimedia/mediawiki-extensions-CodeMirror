const CodeMirror = require( '../../resources/codemirror.js' );
const CodeMirrorChild = require( '../../resources/codemirror.child.js' );
const { mediawiki } = require( '../../resources/modes/mediawiki/codemirror.mediawiki.js' );

let textarea, otherTextarea, cm, childCm, cmLogEditFeatureSpy, childCmLogEditFeatureSpy;

beforeEach( () => {
	textarea = document.createElement( 'textarea' );
	cm = new CodeMirror( textarea, mediawiki() );
	cmLogEditFeatureSpy = jest.spyOn( cm, 'logEditFeature' );
	// Force logging of preferences by setting something different first.
	cm.preferences.setPreference( 'activeLine', true );
	cm.initialize();
	otherTextarea = document.createElement( 'textarea' );
	childCm = new CodeMirrorChild( otherTextarea, cm );
	childCmLogEditFeatureSpy = jest.spyOn( childCm, 'logEditFeature' );
	childCm.initialize();
} );

afterEach( () => {
	mw.hook.mockHooks = {};
	document.body.innerHTML = '';
} );

describe( 'CodeMirrorChild', () => {
	it( 'should use the same langExtension as the primary if none is given', () => {
		expect( childCm.langExtension ).toBe( cm.langExtension );
	} );

	it( 'should toggle when the primary instance is toggled', () => {
		cm.toggle( false );
		expect( cm.isActive ).toBe( false );
		expect( childCm.isActive ).toBe( false );
	} );

	it( 'should sync preferences with the primary', () => {
		expect( childCm.preferences.getPreference( 'lineNumbering' ) ).toBe( true );
		cm.preferences.setPreference( 'lineNumbering', false );
		expect( childCm.preferences.getPreference( 'lineNumbering' ) ).toBe( false );
		expect( cm.preferences.getPreference( 'lineNumbering' ) ).toBe( false );
	} );

	it( 'should not log activation or feature usage', () => {
		expect( cm.preferences.getPreference( 'lineNumbering' ) ).toBe( true );
		expect( childCm.preferences.getPreference( 'lineNumbering' ) ).toBe( true );
		expect( cmLogEditFeatureSpy ).toHaveBeenCalledWith( 'activated' );
		expect( cmLogEditFeatureSpy ).toHaveBeenCalledWith( 'prefs-lineNumbering' );
		expect( childCmLogEditFeatureSpy ).not.toHaveBeenCalledWith( 'prefs-lineNumbering' );
	} );

	it( 'should not make API requests to update preferences', () => {
		childCm.destroy();
		const childSpy = jest.spyOn( childCm.preferences, 'setPreferencesInternal' );
		childCm.initialize();
		cm.preferences.setPreference( 'lineNumbering', false );
		expect( childSpy ).not.toHaveBeenCalled();
	} );
} );
