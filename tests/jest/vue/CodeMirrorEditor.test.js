const { mount, flushPromises } = require( '@vue/test-utils' );
const CodeMirrorEditor = require( '../../../resources/vue/CodeMirrorEditor.vue' );

jest.mock(
	'ext.CodeMirror.modes',
	() => require( '../../../resources/modes/codemirror.mode.exporter.js' ),
	{ virtual: true }
);
jest.mock(
	'ext.CodeMirror.modes.extended',
	() => require( '../../../resources/modes/codemirror.mode.extended.exporter.js' ),
	{ virtual: true }
);

// Mounted wrappers, unmounted after each test so no editor outlives it.
const wrappers = [];

/**
 * Mount the component without waiting for the editor.
 *
 * @param {Object} [props]
 * @return {Object}
 */
function mountComponent( props = {} ) {
	const wrapper = mount( CodeMirrorEditor, {
		props: Object.assign( { mode: 'javascript' }, props ),
		attachTo: document.body
	} );
	wrappers.push( wrapper );
	return wrapper;
}

/**
 * Mount the component and wait for the editor to be created.
 *
 * @param {Object} [props]
 * @return {Promise<Object>}
 */
async function mountEditor( props = {} ) {
	const wrapper = mountComponent( props );
	await flushPromises();
	return wrapper;
}

/**
 * The CodeMirror instance from the last 'ready' event.
 *
 * @param {Object} wrapper
 * @return {Object}
 */
function readyInstance( wrapper ) {
	const events = wrapper.emitted( 'ready' );
	return events[ events.length - 1 ][ 0 ];
}

describe( 'CodeMirrorEditor', () => {
	beforeEach( () => {
		mockUserOptionsGet();
		mw.loader.using = jest.fn().mockResolvedValue();
	} );

	afterEach( () => {
		while ( wrappers.length ) {
			const wrapper = wrappers.pop();
			if ( wrapper.vm ) {
				wrapper.unmount();
			}
		}
	} );

	describe( 'before the editor loads', () => {
		it( 'renders a usable textarea', () => {
			const wrapper = mountComponent( { modelValue: 'let a = 1;' } );
			const textarea = wrapper.find( 'textarea' );
			expect( textarea.exists() ).toBe( true );
			expect( textarea.element.value ).toBe( 'let a = 1;' );
		} );

		it( 'emits input from the plain textarea', async () => {
			const wrapper = mountComponent();
			const textarea = wrapper.find( 'textarea' );
			textarea.element.value = 'typed';
			await textarea.trigger( 'input' );
			expect( wrapper.emitted( 'update:modelValue' )[ 0 ] ).toEqual( [ 'typed' ] );
		} );
	} );

	describe( 'attribute fallthrough', () => {
		const attrs = {
			class: 'consumer-class',
			style: 'margin: 1px',
			'data-testid': 'consumer-testid',
			id: 'my-id',
			'aria-label': 'Code'
		};

		it( 'keeps class, style and data-testid on the root', async () => {
			const wrapper = await mountEditor( attrs );
			expect( wrapper.classes() ).toContain( 'consumer-class' );
			expect( wrapper.classes() ).toContain( 'ext-codemirror-editor' );
			expect( wrapper.attributes( 'style' ) ).toContain( 'margin' );
			expect( wrapper.attributes( 'data-testid' ) ).toBe( 'consumer-testid' );
		} );

		// CodeMirror hides the textarea once it loads, so a class or a test hook
		// would be useless there.
		it( 'keeps class, style and data-testid off the textarea', async () => {
			const wrapper = await mountEditor( attrs );
			const textarea = wrapper.find( 'textarea' );
			expect( textarea.classes() ).not.toContain( 'consumer-class' );
			expect( textarea.attributes( 'style' ) ).toBeUndefined();
			expect( textarea.attributes( 'data-testid' ) ).toBeUndefined();
		} );

		it( 'sets no data-testid when the caller passes none', async () => {
			const wrapper = await mountEditor();
			expect( wrapper.attributes( 'data-testid' ) ).toBeUndefined();
		} );

		it( 'passes every other attribute to the textarea', async () => {
			const wrapper = await mountEditor( attrs );
			const textarea = wrapper.find( 'textarea' );
			expect( textarea.attributes( 'id' ) ).toBe( 'my-id' );
			expect( textarea.attributes( 'aria-label' ) ).toBe( 'Code' );
			expect( wrapper.attributes( 'id' ) ).toBeUndefined();
		} );

		it( 'moves the class to the root when the caller changes it', async () => {
			const parent = mount( {
				components: { CodeMirrorEditor },
				data: () => ( { cssClass: 'first' } ),
				template: '<code-mirror-editor mode="javascript" :class="cssClass" />'
			}, { attachTo: document.body } );
			wrappers.push( parent );
			await flushPromises();
			const root = parent.find( '.ext-codemirror-editor' );
			expect( root.classes() ).toContain( 'first' );
			await parent.setData( { cssClass: 'second' } );
			expect( root.classes() ).toContain( 'second' );
			expect( root.classes() ).not.toContain( 'first' );
		} );
	} );

	describe( 'height', () => {
		// CodeMirror reports 14px per line in jsdom.
		const lineHeight = 14;

		it( 'keeps one height by default', async () => {
			const wrapper = await mountEditor();
			expect( wrapper.classes() ).not.toContain( 'ext-codemirror-editor--auto-height' );
			expect( wrapper.attributes( 'style' ) ).toBeUndefined();
		} );

		it( 'grows from rows when autoHeight is set', async () => {
			const wrapper = await mountEditor( { autoHeight: true, rows: 5 } );
			expect( wrapper.classes() ).toContain( 'ext-codemirror-editor--auto-height' );
			expect( wrapper.attributes( 'style' ) )
				.toContain( `--ext-codemirror-editor-min-height: ${ 5 * lineHeight }px` );
			expect( wrapper.attributes( 'style' ) )
				.not.toContain( 'max-height' );
		} );

		it( 'caps the height at maxRows, and grows without autoHeight', async () => {
			const wrapper = await mountEditor( { maxRows: 20, rows: 5 } );
			expect( wrapper.classes() ).toContain( 'ext-codemirror-editor--auto-height' );
			expect( wrapper.attributes( 'style' ) )
				.toContain( `--ext-codemirror-editor-max-height: ${ 20 * lineHeight }px` );
		} );

		it( 'follows a change to maxRows', async () => {
			const wrapper = await mountEditor( { maxRows: 20 } );
			await wrapper.setProps( { maxRows: 30 } );
			expect( wrapper.attributes( 'style' ) )
				.toContain( `--ext-codemirror-editor-max-height: ${ 30 * lineHeight }px` );
		} );
	} );

	describe( 'loading', () => {
		it( 'loads the module for the mode and emits ready', async () => {
			const wrapper = await mountEditor( { mode: 'python' } );
			expect( mw.loader.using ).toHaveBeenCalledWith( 'ext.CodeMirror.modes.extended' );
			expect( readyInstance( wrapper ).mode ).toBe( 'python' );
		} );

		it( 'seeds the document from modelValue', async () => {
			const wrapper = await mountEditor( { modelValue: 'let a = 1;' } );
			expect( readyInstance( wrapper ).view.state.doc.toString() ).toBe( 'let a = 1;' );
		} );

		it( 'emits error and no ready for an unknown mode', async () => {
			const wrapper = await mountEditor( { mode: 'klingon' } );
			expect( wrapper.emitted( 'error' ) ).toHaveLength( 1 );
			expect( wrapper.emitted( 'ready' ) ).toBeUndefined();
		} );

		// Resolving into an unmounted component would build an editor into dead DOM.
		it( 'discards a load that finishes after unmounting', async () => {
			let resolveUsing;
			mw.loader.using = jest.fn( () => new Promise( ( resolve ) => {
				resolveUsing = resolve;
			} ) );
			const wrapper = mountComponent();
			wrapper.unmount();
			resolveUsing();
			await flushPromises();
			expect( wrapper.emitted( 'ready' ) ).toBeUndefined();
		} );

		it( 'does not report a load that fails after unmounting', async () => {
			let rejectUsing;
			mw.loader.using = jest.fn( () => new Promise( ( resolve, reject ) => {
				rejectUsing = reject;
			} ) );
			const wrapper = mountComponent();
			wrapper.unmount();
			rejectUsing( new Error( 'network went away' ) );
			await flushPromises();
			expect( wrapper.emitted( 'error' ) ).toBeUndefined();
			expect( mw.log.error ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'v-model', () => {
		it( 'applies an external change to the document', async () => {
			const wrapper = await mountEditor( { modelValue: 'one' } );
			await wrapper.setProps( { modelValue: 'two' } );
			expect( readyInstance( wrapper ).view.state.doc.toString() ).toBe( 'two' );
		} );

		it( 'emits changes made in the editor', async () => {
			const wrapper = await mountEditor( { modelValue: 'one' } );
			const cm = readyInstance( wrapper );
			cm.view.dispatch( { changes: { from: 0, to: 3, insert: 'three' } } );
			const emitted = wrapper.emitted( 'update:modelValue' );
			expect( emitted[ emitted.length - 1 ] ).toEqual( [ 'three' ] );
		} );

		// Without the guard, echoing our own emit back in would loop.
		it( 'ignores a modelValue the document already holds', async () => {
			const wrapper = await mountEditor( { modelValue: 'same' } );
			const cm = readyInstance( wrapper );
			const dispatch = jest.spyOn( cm.view, 'dispatch' );
			await wrapper.setProps( { modelValue: 'same' } );
			expect( dispatch ).not.toHaveBeenCalled();
		} );

		it( 'clamps the selection when the new value is shorter', async () => {
			const wrapper = await mountEditor( { modelValue: 'abcdefghij' } );
			const cm = readyInstance( wrapper );
			cm.view.dispatch( { selection: { anchor: 9, head: 9 } } );
			await wrapper.setProps( { modelValue: 'abc' } );
			expect( cm.view.state.selection.main.anchor ).toBe( 3 );
		} );

		it( 'keeps the cursor when the new value is longer', async () => {
			const wrapper = await mountEditor( { modelValue: 'abc' } );
			const cm = readyInstance( wrapper );
			cm.view.dispatch( { selection: { anchor: 2, head: 2 } } );
			await wrapper.setProps( { modelValue: 'abcdefghij' } );
			expect( cm.view.state.selection.main.anchor ).toBe( 2 );
		} );
	} );

	describe( 'focus and blur', () => {
		it( 'relays focus and blur from the textarea', async () => {
			const wrapper = mountComponent();
			const textarea = wrapper.get( '.ext-codemirror-editor__textarea' );
			await textarea.trigger( 'focus' );
			await textarea.trigger( 'blur' );
			expect( wrapper.emitted( 'focus' ) ).toHaveLength( 1 );
			expect( wrapper.emitted( 'blur' ) ).toHaveLength( 1 );
		} );
	} );

	describe( 'readOnly and disabled', () => {
		// The core class takes read-only from the textarea, which this component binds
		// to the prop, and only refuses changes made through $.textSelection.
		it( 'still applies external changes when read-only', async () => {
			const wrapper = await mountEditor( { modelValue: 'one', readOnly: true } );
			const cm = readyInstance( wrapper );
			expect( cm.view.state.readOnly ).toBe( true );
			await wrapper.setProps( { modelValue: 'two' } );
			expect( cm.view.state.doc.toString() ).toBe( 'two' );
		} );

		it( 'toggles read-only without rebuilding the editor', async () => {
			const wrapper = await mountEditor();
			const cm = readyInstance( wrapper );
			expect( cm.view.state.readOnly ).toBe( false );
			await wrapper.setProps( { readOnly: true } );
			expect( cm.view.state.readOnly ).toBe( true );
			expect( wrapper.emitted( 'ready' ) ).toHaveLength( 1 );
		} );

		it( 'keeps the core read-only state in step with the prop', async () => {
			const wrapper = await mountEditor();
			const cm = readyInstance( wrapper );
			expect( cm.readOnly ).toBe( false );
			await wrapper.setProps( { readOnly: true } );
			expect( cm.readOnly ).toBe( true );
			await wrapper.setProps( { readOnly: false } );
			expect( cm.readOnly ).toBe( false );
		} );

		it( 'makes a disabled editor non-editable', async () => {
			const wrapper = await mountEditor( { disabled: true } );
			const cm = readyInstance( wrapper );
			expect( cm.view.state.readOnly ).toBe( true );
			expect( wrapper.classes() ).toContain( 'ext-codemirror-editor--disabled' );
		} );
	} );

	describe( 'preferences', () => {
		it( 'does not focus or save preferences by default', async () => {
			const wrapper = await mountEditor();
			const cm = readyInstance( wrapper );
			expect( cm.preferences.getPreference( 'autofocus' ) ).toBe( false );
			expect( mw.Api.prototype.saveOption ).not.toHaveBeenCalled();
		} );

		it( 'honours the autofocus prop', async () => {
			const wrapper = await mountEditor( { autofocus: true } );
			expect( readyInstance( wrapper ).preferences.getPreference( 'autofocus' ) ).toBe( true );
		} );

		it( 'leaves the compact panels preference to the user by default', async () => {
			const wrapper = await mountEditor();
			const { preferences } = readyInstance( wrapper );
			expect( preferences.disabledPreferences.has( 'compactPanels' ) ).toBe( false );
		} );

		it( 'honours the compact prop', async () => {
			const wrapper = await mountEditor( { compact: true } );
			const { preferences } = readyInstance( wrapper );
			expect( preferences.getPreference( 'compactPanels' ) ).toBe( true );
			expect( preferences.disabledPreferences.has( 'compactPanels' ) ).toBe( true );
		} );
	} );

	describe( 'mode changes', () => {
		it( 'rebuilds the editor and keeps the contents', async () => {
			const wrapper = await mountEditor( { modelValue: 'a { color: red; }' } );
			await wrapper.setProps( { mode: 'css' } );
			await flushPromises();
			expect( wrapper.emitted( 'ready' ) ).toHaveLength( 2 );
			const cm = readyInstance( wrapper );
			expect( cm.mode ).toBe( 'css' );
			expect( cm.view.state.doc.toString() ).toBe( 'a { color: red; }' );
		} );
	} );

	describe( 'teardown', () => {
		it( 'destroys the editor on unmount', async () => {
			const wrapper = await mountEditor();
			const cm = readyInstance( wrapper );
			wrapper.unmount();
			expect( cm.view ).toBeNull();
		} );
	} );
} );
