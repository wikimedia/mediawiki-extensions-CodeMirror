const CodeMirrorCodex = require( '../../resources/codemirror.codex.js' );

// CodeMirrorPanel is tagged as abstract, but being JavaScript it isn't a
// "real" abstract class, so we can instantiate it directly for testing purposes.
const cmCodex = new CodeMirrorCodex();

describe( 'CodeMirrorCodex', () => {
	it( 'should create a Codex TextInput', () => {
		const [ inputWrapper, input ] = cmCodex.getTextInput( 'foo', 'bar', 'codemirror-find' );
		expect( inputWrapper.className ).toBe( 'cdx-text-input cm-mw-panel--text-input' );
		expect( input.className ).toBe( 'cdx-text-input__input' );
		expect( input.type ).toBe( 'text' );
		expect( input.name ).toBe( 'foo' );
		// No i18n in unit tests, so we only check for the key.
		expect( input.placeholder ).toBe( 'codemirror-find' );
		expect( input.value ).toBe( 'bar' );
	} );

	it( 'should create a Codex Button with no icon', () => {
		const buttonNoIcon = cmCodex.getButton( 'foo' );
		expect( buttonNoIcon.tagName ).toBe( 'BUTTON' );
		expect( buttonNoIcon.className ).toBe(
			'cdx-button cm-mw-panel--button cdx-button--action-default cdx-button--weight-normal'
		);
		expect( buttonNoIcon.type ).toBe( 'button' );
		expect( buttonNoIcon.children.length ).toBe( 0 );
	} );

	it( 'should create a Codex button with an icon and a label', () => {
		const buttonWithIcon = cmCodex.getButton( 'foo', { icon: 'bar' } );
		expect( buttonWithIcon.tagName ).toBe( 'BUTTON' );
		expect( buttonWithIcon.className ).toBe(
			'cdx-button cm-mw-panel--button cdx-button--action-default cdx-button--weight-normal'
		);
		expect( buttonWithIcon.type ).toBe( 'button' );
		expect( buttonWithIcon.children.length ).toBe( 1 );
		const iconSpan = buttonWithIcon.children[ 0 ];
		expect( iconSpan.tagName ).toBe( 'SPAN' );
		expect( iconSpan.className ).toBe(
			'cdx-button__icon cm-mw-icon--bar'
		);
		expect( iconSpan.getAttribute( 'aria-hidden' ) ).toBe( 'true' );
	} );

	it( 'should create an icon-only Codex button', () => {
		const buttonIconOnly = cmCodex.getButton( 'foo', { icon: 'bar', iconOnly: true } );
		expect( buttonIconOnly.tagName ).toBe( 'BUTTON' );
		expect( buttonIconOnly.className ).toBe(
			'cdx-button cm-mw-panel--button cdx-button--action-default ' +
			'cdx-button--weight-normal cdx-button--icon-only'
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

	it( 'should create a destructive quiet button', () => {
		const buttonDestructive = cmCodex.getButton( 'foo', { action: 'destructive', weight: 'quiet' } );
		expect( buttonDestructive.tagName ).toBe( 'BUTTON' );
		expect( buttonDestructive.className ).toBe(
			'cdx-button cm-mw-panel--button cdx-button--action-destructive cdx-button--weight-quiet'
		);
		expect( buttonDestructive.type ).toBe( 'button' );
	} );

	it( 'should create a Codex Checkbox', () => {
		const [ checkboxWrapper, checkbox ] = cmCodex.getCheckbox( 'foo', 'bar', true );
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
		const toggleButtonOn = cmCodex.getToggleButton( 'foo', 'bar', 'baz', true );
		expect( toggleButtonOn.tagName ).toBe( 'BUTTON' );
		expect( toggleButtonOn.className ).toBe(
			'cdx-toggle-button cdx-toggle-button--framed cdx-toggle-button--toggled-on cm-mw-panel--toggle-button'
		);
		expect( toggleButtonOn.type ).toBe( 'button' );
		expect( toggleButtonOn.dataset.checked ).toBe( 'true' );
		expect( toggleButtonOn.getAttribute( 'aria-pressed' ) ).toBe( 'true' );
		expect( toggleButtonOn.title ).toBe( 'bar' );
		expect( toggleButtonOn.getAttribute( 'aria-label' ) ).toBe( 'bar' );
		expect( toggleButtonOn.children.length ).toBe( 1 );
		const iconSpan = toggleButtonOn.children[ 0 ];
		expect( iconSpan.tagName ).toBe( 'SPAN' );
		expect( iconSpan.className ).toBe( 'cdx-icon cdx-icon--medium cm-mw-icon--baz' );

		const toggleButtonOff = cmCodex.getToggleButton( 'foo', 'bar', 'baz', false );
		expect( toggleButtonOff.className ).toBe(
			'cdx-toggle-button cdx-toggle-button--framed cdx-toggle-button--toggled-off cm-mw-panel--toggle-button'
		);
		expect( toggleButtonOff.type ).toBe( 'button' );
		expect( toggleButtonOff.dataset.checked ).toBe( 'false' );
		expect( toggleButtonOff.getAttribute( 'aria-pressed' ) ).toBe( 'false' );
	} );

	it( 'should create a Codex fieldset with a legend', () => {
		const field1 = document.createElement( 'p' );
		const field2 = document.createElement( 'p' );
		const fieldset = cmCodex.getFieldset( 'legend text', field1, field2 );
		expect( fieldset.tagName ).toBe( 'FIELDSET' );
		expect( fieldset.className ).toBe( 'cm-mw-panel--fieldset cdx-field' );
		expect( fieldset.children.length ).toBe( 3 );
		const legend = fieldset.children[ 0 ];
		expect( legend.tagName ).toBe( 'LEGEND' );
		expect( legend.className ).toBe( 'cdx-label' );
		expect( legend.textContent ).toBe( 'legend text' );
		expect( fieldset.children[ 1 ] ).toBe( field1 );
		expect( fieldset.children[ 2 ] ).toBe( field2 );
	} );

	it( 'should show a Codex Dialog with actions', () => {
		const contents = document.createElement( 'p' );
		contents.textContent = 'Dialog content';
		const actionBtn = cmCodex.getButton( 'Action' );
		const backdrop = cmCodex.showDialog( 'Dialog Title', 'example', contents, actionBtn );
		expect( backdrop.className ).toBe( 'cdx-dialog-backdrop cdx-dialog-fade-enter-active cm-mw-dialog-backdrop' );
		const dialog = backdrop.children[ 1 ];
		expect( dialog.className ).toBe( 'cdx-dialog cm-mw-dialog cm-mw-example-dialog cdx-dialog--horizontal-actions' );
		expect( dialog.children.length ).toBe( 4 );
		expect( dialog.children[ 0 ].tagName ).toBe( 'HEADER' );
		expect( dialog.children[ 0 ].className ).toBe( 'cdx-dialog__header cdx-dialog__header--default' );
		expect( dialog.children[ 0 ].textContent ).toBe( 'Dialog Title' );
		expect( dialog.children[ 2 ].className ).toBe( 'cdx-dialog__body' );
		expect( dialog.children[ 2 ].textContent ).toBe( 'Dialog content' );
		const footer = dialog.children[ 3 ];
		expect( footer.tagName ).toBe( 'FOOTER' );
		expect( footer.className ).toBe( 'cdx-dialog__footer cdx-dialog__footer--default' );
		const actions = footer.children[ 0 ];
		expect( actions.className ).toBe( 'cdx-dialog__footer__actions' );
		expect( actions.children[ 0 ] ).toBe( actionBtn );
	} );

	it( 'should restore focus to what it was before the dialog was opened', () => {
		const input = document.createElement( 'input' );
		document.body.appendChild( input );
		input.focus();
		expect( document.activeElement ).toBe( input );
		cmCodex.showDialog( 'Dialog Title', 'example', document.createElement( 'p' ) );
		expect( document.activeElement ).not.toBe( input );
		cmCodex.animateDialog( false );
		cmCodex.dialog.dispatchEvent( new Event( 'transitionend' ) );
		expect( document.activeElement ).toBe( input );
		document.body.removeChild( input );
	} );

	it( 'should use random IDs for checkboxes', () => {
		const [ , checkbox1 ] = cmCodex.getCheckbox( 'foo1', 'bar1', true );
		const [ , checkbox2 ] = cmCodex.getCheckbox( 'foo2', 'bar2', false );
		expect( checkbox1.id ).toBeDefined();
		expect( checkbox2.id ).toBeDefined();
		expect( checkbox1.id ).not.toBe( checkbox2.id );
	} );
} );
