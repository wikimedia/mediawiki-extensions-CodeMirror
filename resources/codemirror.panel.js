const { EditorView, Extension, Panel } = require( 'ext.CodeMirror.v6.lib' );

/**
 * Abstract class for a panel that can be used with CodeMirror.
 * This class provides methods to create CSS-only Codex components.
 *
 * @see https://codemirror.net/docs/ref/#h_panels
 * @abstract
 */
class CodeMirrorPanel {
	/**
	 * @constructor
	 */
	constructor() {
		/**
		 * @type {EditorView}
		 */
		this.view = undefined;
	}

	/**
	 * Get the panel and any associated keymaps as a CodeMirror Extension.
	 *
	 * @abstract
	 * @type {Extension}
	 */
	// eslint-disable-next-line getter-return
	get extension() {}

	/**
	 * Get the Panel object.
	 *
	 * @abstract
	 * @type {Panel}
	 */
	// eslint-disable-next-line getter-return
	get panel() {}

	/**
	 * Get a CSS-only Codex TextInput.
	 *
	 * @param {string} name
	 * @param {string} [value='']
	 * @param {string} placeholder
	 * @return {Array<HTMLElement>} [HTMLDivElement, HTMLInputElement]
	 * @internal
	 */
	getTextInput( name, value = '', placeholder = '' ) {
		const wrapper = document.createElement( 'div' );
		wrapper.className = 'cdx-text-input cm-mw-panel--text-input';
		const input = document.createElement( 'input' );
		input.className = 'cdx-text-input__input';
		input.type = 'text';
		input.name = name;
		// The following messages may be used here:
		// * codemirror-find
		// * codemirror-replace-placeholder
		input.placeholder = placeholder ? mw.msg( placeholder ) : '';
		input.value = value;
		wrapper.appendChild( input );
		return [ wrapper, input ];
	}

	/**
	 * Get a CSS-only Codex Button.
	 *
	 * @param {string} label
	 * @param {string|null} [icon=null]
	 * @param {boolean} [iconOnly=false]
	 * @return {HTMLButtonElement}
	 * @internal
	 */
	getButton( label, icon = null, iconOnly = false ) {
		const button = document.createElement( 'button' );
		button.className = 'cdx-button cm-mw-panel--button';
		button.type = 'button';

		if ( icon ) {
			const iconSpan = document.createElement( 'span' );
			// The following CSS classes may be used here:
			// * cm-mw-icon--previous
			// * cm-mw-icon--next
			// * cm-mw-icon--all
			// * cm-mw-icon--replace
			// * cm-mw-icon--replace-all
			// * cm-mw-icon--done
			// * cm-mw-icon--goto-line-go
			iconSpan.className = 'cdx-button__icon cm-mw-icon--' + icon;

			if ( !iconOnly ) {
				iconSpan.setAttribute( 'aria-hidden', 'true' );
			}

			button.appendChild( iconSpan );
		}

		// The following messages may be used here:
		// * codemirror-next
		// * codemirror-previous
		// * codemirror-all
		// * codemirror-replace
		// * codemirror-replace-all
		const message = mw.msg( label );
		if ( iconOnly ) {
			button.classList.add( 'cdx-button--icon-only' );
			button.title = message;
			button.setAttribute( 'aria-label', message );
		} else {
			button.append( message );
		}

		return button;
	}

	/**
	 * Get a CSS-only Codex Checkbox.
	 *
	 * @param {string} name
	 * @param {string} label
	 * @param {boolean} [checked=false]
	 * @return {Array<HTMLElement>} [HTMLSpanElement, HTMLInputElement]
	 * @internal
	 */
	getCheckbox( name, label, checked = false ) {
		const wrapper = document.createElement( 'span' );
		wrapper.className = 'cdx-checkbox cdx-checkbox--inline cm-mw-panel--checkbox';
		const input = document.createElement( 'input' );
		input.className = 'cdx-checkbox__input';
		input.id = `cm-mw-panel--checkbox-${ name }`;
		input.type = 'checkbox';
		input.name = name;
		input.checked = checked;
		wrapper.appendChild( input );
		const emptyIcon = document.createElement( 'span' );
		emptyIcon.className = 'cdx-checkbox__icon';
		wrapper.appendChild( emptyIcon );
		const labelWrapper = document.createElement( 'div' );
		labelWrapper.className = 'cdx-checkbox__label cdx-label';
		const labelElement = document.createElement( 'label' );
		labelElement.className = 'cdx-label__label';
		labelElement.htmlFor = input.id;
		const innerSpan = document.createElement( 'span' );
		innerSpan.className = 'cdx-label__label__text';
		// The following messages may be used here:
		// * codemirror-match-case
		// * codemirror-regexp
		// * codemirror-by-word
		innerSpan.textContent = mw.msg( label );
		labelElement.appendChild( innerSpan );
		labelWrapper.appendChild( labelElement );
		wrapper.appendChild( labelWrapper );
		return [ wrapper, input ];
	}

	/**
	 * Get a CSS-only Codex ToggleButton.
	 *
	 * @param {string} name
	 * @param {string} label
	 * @param {string} icon
	 * @param {boolean} [checked=false]
	 * @return {HTMLButtonElement}
	 * @internal
	 */
	getToggleButton( name, label, icon, checked = false ) {
		const btn = document.createElement( 'button' );
		// The following CSS classes may be used here:
		// * cdx-toggle-button--toggled-on
		// * cdx-toggle-button--toggled-off
		btn.className = 'cdx-toggle-button cdx-toggle-button--framed ' +
			`cdx-toggle-button--toggled-${ checked ? 'on' : 'off' } cm-mw-panel--toggle-button`;
		btn.dataset.checked = String( checked );
		btn.setAttribute( 'aria-pressed', checked );
		// The following messages may be used here:
		// * codemirror-match-case
		// * codemirror-regexp
		// * codemirror-by-word
		const message = mw.msg( label );
		btn.title = message;
		btn.setAttribute( 'aria-label', message );

		// Add the icon.
		const iconWrapper = document.createElement( 'span' );
		// The following CSS classes may be used here:
		// * cm-mw-icon--match-case
		// * cm-mw-icon--regexp
		// * cm-mw-icon--quotes
		iconWrapper.className = 'cdx-icon cdx-icon--medium cm-mw-icon--' + icon;
		btn.appendChild( iconWrapper );

		// Add the click handler.
		btn.addEventListener( 'click', ( e ) => {
			e.preventDefault();
			const toggled = btn.dataset.checked === 'true';
			btn.dataset.checked = String( !toggled );
			btn.setAttribute( 'aria-pressed', String( !toggled ) );
			btn.classList.toggle( 'cdx-toggle-button--toggled-on', !toggled );
			btn.classList.toggle( 'cdx-toggle-button--toggled-off', toggled );
		} );

		return btn;
	}
}

module.exports = CodeMirrorPanel;
