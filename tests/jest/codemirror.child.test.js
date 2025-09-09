const CodeMirror = require( '../../resources/codemirror.js' );
const CodeMirrorChild = require( '../../resources/codemirror.child.js' );
const { mediawiki } = require( '../../resources/modes/mediawiki/codemirror.mediawiki.js' );

let textarea, otherTextarea, cm, cmLogEditFeatureSpy;

beforeEach( () => {
	textarea = document.createElement( 'textarea' );
	cm = new CodeMirror( textarea, mediawiki() );
	cmLogEditFeatureSpy = jest.spyOn( cm, 'logEditFeature' );
	cm.initialize();
	otherTextarea = document.createElement( 'textarea' );
} );

afterEach( () => {
	mw.hook.mockHooks = {};
	document.body.innerHTML = '';
} );

describe( 'CodeMirrorChild', () => {
	it( 'should use the same langExtension as the primary if none is given', () => {
		const childCm = new CodeMirrorChild( otherTextarea, cm );
		childCm.initialize();
		expect( childCm.langExtension ).toBe( cm.langExtension );
	} );

	it( 'should toggle when the primary instance is toggled', () => {
		const childCm = new CodeMirrorChild( otherTextarea, cm );
		childCm.initialize();
		cm.toggle( false );
		expect( cm.isActive ).toBe( false );
		expect( childCm.isActive ).toBe( false );
	} );

	it( 'should sync preferences with the primary', () => {
		const childCm = new CodeMirrorChild( otherTextarea, cm );
		childCm.initialize();
		expect( childCm.preferences.getPreference( 'lineNumbering' ) ).toBe( true );
		cm.preferences.setPreference( 'lineNumbering', false );
		expect( childCm.preferences.getPreference( 'lineNumbering' ) ).toBe( false );
		expect( cm.preferences.getPreference( 'lineNumbering' ) ).toBe( false );
	} );

	it( 'should not log activation or feature usage', () => {
		const childCm = new CodeMirrorChild( otherTextarea, cm );
		const childSpy = jest.spyOn( childCm, 'logEditFeature' );
		childCm.initialize();
		expect( cm.preferences.getPreference( 'lineNumbering' ) ).toBe( true );
		expect( childCm.preferences.getPreference( 'lineNumbering' ) ).toBe( true );
		expect( cmLogEditFeatureSpy ).toHaveBeenCalledWith( 'activated' );
		expect( cmLogEditFeatureSpy ).toHaveBeenCalledWith( 'prefs-lineNumbering' );
		expect( childSpy ).not.toHaveBeenCalledWith( 'prefs-lineNumbering' );
	} );

	it( 'should not make API requests to update preferences', () => {
		const childCm = new CodeMirrorChild( otherTextarea, cm );
		const childSpy = jest.spyOn( childCm.preferences, 'setPreferencesInternal' );
		childCm.initialize();
		cm.preferences.setPreference( 'lineNumbering', false );
		expect( childSpy ).not.toHaveBeenCalled();
	} );
} );
