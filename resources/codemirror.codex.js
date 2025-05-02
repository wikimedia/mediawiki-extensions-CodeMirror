/**
 * Provides methods to create CSS-only Codex components.
 *
 * @todo Move HTML generation to Mustache templates.
 */
class CodeMirrorCodex {
	constructor() {
		/**
		 * @type {HTMLDivElement|null}
		 */
		this.dialog = null;
	}

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
		btn.type = 'button';
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

	/**
	 * Get a CSS-only Codex Fieldset.
	 *
	 * @param {string} legendText
	 * @param {...HTMLElement[]} fields
	 * @return {Element}
	 * @internal
	 */
	getFieldset( legendText, ...fields ) {
		const fieldset = document.createElement( 'fieldset' );
		fieldset.className = 'cm-mw-panel--fieldset cdx-field';
		const legend = document.createElement( 'legend' );
		legend.className = 'cdx-label';
		const innerSpan = document.createElement( 'span' );
		innerSpan.className = 'cdx-label__label__text';
		innerSpan.textContent = legendText;
		const helpSpan = document.createElement( 'span' );
		helpSpan.className = 'cm-mw-panel--help';
		const helpLink = document.createElement( 'a' );
		helpLink.href = 'https://www.mediawiki.org/wiki/Special:MyLanguage/Help:Extension:CodeMirror';
		helpLink.target = '_blank';
		helpLink.textContent = mw.msg( 'codemirror-prefs-help' ).toLowerCase();
		// Click listener added in CodeMirrorKeymap since we don't have a CodeMirror instance here.
		const shortcutLink = document.createElement( 'a' );
		shortcutLink.className = 'cm-mw-panel--kbd-help';
		shortcutLink.href = 'https://www.mediawiki.org/wiki/Special:MyLanguage/Help:Extension:CodeMirror#Keyboard_shortcuts';
		shortcutLink.textContent = mw.msg( 'codemirror-keymap-help-title' ).toLowerCase();
		shortcutLink.onclick = ( e ) => e.preventDefault();
		helpSpan.append(
			' ',
			mw.msg( 'parentheses-start' ),
			helpLink,
			mw.msg( 'pipe-separator' ),
			shortcutLink,
			mw.msg( 'parentheses-end' )
		);
		innerSpan.appendChild( helpSpan );
		legend.appendChild( innerSpan );
		fieldset.appendChild( legend );
		fieldset.append( ...fields );
		return fieldset;
	}

	/**
	 * Show a Codex Dialog.
	 *
	 * @param {string} title
	 * @param {HTMLElement|HTMLElement[]} contents
	 * @return {boolean}
	 * @internal
	 */
	showDialog( title, contents ) {
		if ( this.dialog ) {
			this.animateDialog( true );
			return true;
		}

		contents = Array.isArray( contents ) ? contents : [ contents ];
		const backdrop = document.createElement( 'div' );
		backdrop.classList.add(
			'cdx-dialog-backdrop',
			// These classes are used by the fade animation.
			// We always want them enabled, since dialog content is not interactable
			// and thus we don't need to worry about conflicting styles.
			'cdx-dialog-fade-enter-active',
			'cm-mw-dialog-backdrop',
			'cm-mw-dialog--hidden'
		);
		const tabindex = document.createElement( 'div' );
		tabindex.tabIndex = 0;
		backdrop.appendChild( tabindex );

		const dialog = document.createElement( 'div' );
		dialog.classList.add( 'cdx-dialog', 'cm-mw-dialog', 'cm-mw-keymap-dialog' );
		backdrop.appendChild( dialog );
		backdrop.addEventListener( 'click', ( e ) => {
			if ( e.target === backdrop ) {
				this.animateDialog( false );
			}
		} );

		const header = document.createElement( 'header' );
		header.classList.add( 'cdx-dialog__header', 'cdx-dialog__header--default' );
		const headerTitleGroup = document.createElement( 'div' );
		headerTitleGroup.classList.add( 'cdx-dialog__header__title-group' );
		const h2 = document.createElement( 'h2' );
		h2.id = 'cdx-dialog__header__title-group';
		h2.classList.add( 'cdx-dialog__header__title' );
		// The following messages may be used here:
		// * codemirror-keymap-help-title
		// * codemirror-prefs-title
		h2.textContent = mw.msg( title );
		headerTitleGroup.appendChild( h2 );
		header.appendChild( headerTitleGroup );

		const closeBtn = document.createElement( 'button' );
		closeBtn.type = 'button';
		closeBtn.classList.add(
			'cdx-button',
			'cdx-button',
			'cdx-button--action-default',
			'cdx-button--weight-quiet',
			'cdx-button--size-medium',
			'cdx-button--icon-only',
			'cdx-dialog__header__close-button',
			'cdx-dialog__header__close'
		);
		closeBtn.setAttribute( 'aria-label', mw.msg( 'codemirror-keymap-help-close' ) );
		const cdxIcon = document.createElement( 'span' );
		cdxIcon.classList.add( 'cdx-button__icon', 'cm-mw-icon--close' );
		closeBtn.appendChild( cdxIcon );
		closeBtn.addEventListener( 'click', this.animateDialog.bind( this, false ) );
		header.appendChild( closeBtn );
		dialog.appendChild( header );

		const focusTrap = document.createElement( 'div' );
		focusTrap.tabIndex = -1;
		dialog.appendChild( focusTrap );

		const body = document.createElement( 'div' );
		body.classList.add( 'cdx-dialog__body' );
		body.append( ...contents );
		dialog.appendChild( body );

		backdrop.appendChild( tabindex.cloneNode() );

		this.dialog = backdrop;

		document.body.appendChild( backdrop );
		this.animateDialog( true );

		return true;
	}

	/**
	 * Fade the dialog in or out, adjusting for scrollbar widths to prevent shifting of content.
	 * This almost fully mimics the way the Codex handles its Dialog component, with the exception
	 * that we don't force a focus trap, nor do we set aria-hidden on other elements in the DOM.
	 * This is to keep our implementation simple until something like T382532 is realized.
	 *
	 * @param {boolean} open
	 * @protected
	 */
	animateDialog( open = false ) {
		document.activeElement.blur();
		// Must be unhidden in order to animate.
		this.dialog.classList.remove( 'cm-mw-dialog--hidden' );
		// When the transition ends, hide or show the dialog.
		this.dialog.addEventListener( 'transitionend', () => {
			this.dialog.classList.toggle( 'cm-mw-dialog--hidden', !open );
			if ( open ) {
				this.dialog.querySelector( '[tabindex="0"]' ).focus();
				// Determine the width of the scrollbar and compensate for it if necessary
				const scrollWidth = window.innerWidth - document.documentElement.clientWidth;
				document.documentElement.style.setProperty( 'margin-right', `${ scrollWidth }px` );
			} else {
				document.documentElement.style.removeProperty( 'margin-right' );
			}
			// Toggle a class on <body> to prevent scrolling
			document.body.classList.toggle( 'cdx-dialog-open', open );
		}, { once: true } );
		// Animates the dialog in or out.
		// Use setTimeout() with slight delay to allow rendering threads to catch up.
		setTimeout( () => {
			this.dialog.classList.toggle( 'cm-mw-dialog-animate-show', open );
		}, 50 );

		// Add or remove the keydown listener.
		if ( open && !this.keydownListener ) {
			this.keydownListener = ( e ) => {
				if ( e.key === 'Escape' && !this.dialog.classList.contains( 'cm-mw-dialog--hidden' ) ) {
					this.animateDialog( false );
				}
			};
			document.body.addEventListener( 'keydown', this.keydownListener );
		} else if ( !open && this.keydownListener ) {
			document.body.removeEventListener( 'keydown', this.keydownListener );
			this.keydownListener = null;
		}
	}
}

module.exports = CodeMirrorCodex;
