const CodeMirrorPanel = require( '../../resources/codemirror.panel.js' );

// CodeMirrorPanel is tagged as abstract, but being JavaScript it isn't a
// "real" abstract class, so we can instantiate it directly for testing purposes.
const cmPanel = new CodeMirrorPanel();

describe( 'CodeMirrorPanel', () => {
	it( 'should create a Codex TextInput', () => {
		const [ inputWrapper, input ] = cmPanel.getTextInput( 'foo', 'bar', 'codemirror-find' );
		expect( inputWrapper.className ).toBe( 'cdx-text-input cm-mw-panel--text-input' );
		expect( input.className ).toBe( 'cdx-text-input__input' );
		expect( input.type ).toBe( 'text' );
		expect( input.name ).toBe( 'foo' );
		// No i18n in unit tests, so we only check for the key.
		expect( input.placeholder ).toBe( 'codemirror-find' );
		expect( input.value ).toBe( 'bar' );
	} );

	it( 'should create a Codex Button with no icon', () => {
		const buttonNoIcon = cmPanel.getButton( 'foo' );
		expect( buttonNoIcon.tagName ).toBe( 'BUTTON' );
		expect( buttonNoIcon.className ).toBe( 'cdx-button cm-mw-panel--button' );
		expect( buttonNoIcon.type ).toBe( 'button' );
		expect( buttonNoIcon.children.length ).toBe( 0 );
	} );

	it( 'should create a Codex button with an icon and a label', () => {
		const buttonWithIcon = cmPanel.getButton( 'foo', 'bar' );
		expect( buttonWithIcon.tagName ).toBe( 'BUTTON' );
		expect( buttonWithIcon.className ).toBe( 'cdx-button cm-mw-panel--button' );
		expect( buttonWithIcon.type ).toBe( 'button' );
		expect( buttonWithIcon.children.length ).toBe( 1 );
		const iconSpan = buttonWithIcon.children[ 0 ];
		expect( iconSpan.tagName ).toBe( 'SPAN' );
		expect( iconSpan.className ).toBe( 'cdx-button__icon cm-mw-icon--bar' );
		expect( iconSpan.getAttribute( 'aria-hidden' ) ).toBe( 'true' );
	} );

	it( 'should create an icon-only Codex button', () => {
		const buttonIconOnly = cmPanel.getButton( 'foo', 'bar', true );
		expect( buttonIconOnly.tagName ).toBe( 'BUTTON' );
		expect( buttonIconOnly.className ).toBe(
			'cdx-button cm-mw-panel--button cdx-button--icon-only'
		);
		expect( buttonIconOnly.type ).toBe( 'button' );
		expect( buttonIconOnly.children.length ).toBe( 1 );
		expect( buttonIconOnly.getAttribute( 'aria-label' ) ).toBe( 'foo' );
		expect( buttonIconOnly.title ).toBe( 'foo' );
		const iconSpan = buttonIconOnly.children[ 0 ];
		expect( iconSpan.tagName ).toBe( 'SPAN' );
		expect( iconSpan.className ).toBe( 'cdx-button__icon cm-mw-icon--bar' );
		expect( iconSpan.getAttribute( 'aria-hidden' ) ).toBeNull();
	} );

	it( 'should create a Codex Checkbox', () => {
		const [ checkboxWrapper, checkbox ] = cmPanel.getCheckbox( 'foo', 'bar', true );
		expect( checkboxWrapper.className ).toBe( 'cdx-checkbox cdx-checkbox--inline cm-mw-panel--checkbox' );
		expect( checkboxWrapper.children.length ).toBe( 3 );
		const labelWrapper = checkboxWrapper.children[ 2 ];
		expect( labelWrapper.tagName ).toBe( 'DIV' );
		expect( labelWrapper.className ).toBe( 'cdx-checkbox__label cdx-label' );
		const label = labelWrapper.children[ 0 ];
		expect( label.tagName ).toBe( 'LABEL' );
		expect( label.className ).toBe( 'cdx-label__label' );
		expect( label.textContent ).toBe( 'bar' );
		expect( checkbox.className ).toBe( 'cdx-checkbox__input' );
		expect( checkbox.type ).toBe( 'checkbox' );
		expect( checkbox.name ).toBe( 'foo' );
		expect( checkbox.checked ).toBe( true );
	} );

	it( 'should create a Codex ToggleButton', () => {
		const toggleButtonOn = cmPanel.getToggleButton( 'foo', 'bar', 'baz', true );
		expect( toggleButtonOn.tagName ).toBe( 'BUTTON' );
		expect( toggleButtonOn.className ).toBe(
			'cdx-toggle-button cdx-toggle-button--framed cdx-toggle-button--toggled-on cm-mw-panel--toggle-button'
		);
		expect( toggleButtonOn.dataset.checked ).toBe( 'true' );
		expect( toggleButtonOn.getAttribute( 'aria-pressed' ) ).toBe( 'true' );
		expect( toggleButtonOn.title ).toBe( 'bar' );
		expect( toggleButtonOn.getAttribute( 'aria-label' ) ).toBe( 'bar' );
		expect( toggleButtonOn.children.length ).toBe( 1 );
		const iconSpan = toggleButtonOn.children[ 0 ];
		expect( iconSpan.tagName ).toBe( 'SPAN' );
		expect( iconSpan.className ).toBe( 'cdx-icon cdx-icon--medium cm-mw-icon--baz' );

		const toggleButtonOff = cmPanel.getToggleButton( 'foo', 'bar', 'baz', false );
		expect( toggleButtonOff.className ).toBe(
			'cdx-toggle-button cdx-toggle-button--framed cdx-toggle-button--toggled-off cm-mw-panel--toggle-button'
		);
		expect( toggleButtonOff.dataset.checked ).toBe( 'false' );
		expect( toggleButtonOff.getAttribute( 'aria-pressed' ) ).toBe( 'false' );
	} );
} );
