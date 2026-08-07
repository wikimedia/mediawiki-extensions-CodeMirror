<template>
	<div
		class="ext-codemirror-editor"
		:class="rootClasses"
	>
		<!-- CodeMirror moves this textarea into a wrapper of its own, so nothing
			else may be rendered inside this container. -->
		<div class="ext-codemirror-editor__container">
			<textarea
				ref="textarea"
				data-testid="codemirror-editor-textarea"
				v-bind="$attrs"
				class="ext-codemirror-editor__textarea"
				:value="modelValue"
				:readonly="isReadOnly"
				:rows="rows"
				:placeholder="placeholder"
				@input="onTextareaInput"
				@focus="$emit( 'focus', $event )"
				@blur="$emit( 'blur', $event )"
			></textarea>
		</div>
	</div>
</template>

<script>
const { computed, defineComponent, onBeforeUnmount, onMounted, ref, watch } = require( 'vue' );
const { loadLanguageSupport } = require( './codemirror.modeLoader.js' );

module.exports = exports = defineComponent( {
	name: 'CodeMirrorEditor',

	inheritAttrs: false,

	props: {
		/** Contents of the editor. Use with `v-model`. */
		modelValue: { type: String, default: '' },
		/** Language mode, i.e. 'javascript', 'python' or 'mediawiki'. */
		mode: { type: String, required: true },
		/** Configuration for the mode. Read once, when the editor is created. */
		modeConfig: { type: Object, default: () => ( {} ) },
		/** Make the contents read-only, but still selectable. */
		readOnly: { type: Boolean },
		/** Make the contents read-only and not focusable. */
		disabled: { type: Boolean },
		/** Shown while the editor is empty. */
		placeholder: { type: String, default: '' },
		/** Initial height of the editor, in rows. */
		rows: { type: Number, default: 10 },
		/** Focus the editor once it is ready. */
		autofocus: { type: Boolean },
		/** Theme name, overriding the user's preference. */
		theme: { type: String, default: null }
	},

	emits: [ 'update:modelValue', 'ready', 'error', 'focus', 'blur' ],

	setup( props, { emit } ) {
		const textarea = ref( null );
		let codeMirror = null;
		let lib = null;
		let readOnlyCompartment = null;
		let editableCompartment = null;
		let placeholderCompartment = null;
		// Bumped whenever an in-flight load should be abandoned.
		let loadId = 0;

		const isReadOnly = computed( () => props.readOnly || props.disabled );
		const rootClasses = computed( () => ( {
			'ext-codemirror-editor--disabled': props.disabled
		} ) );

		/* eslint-disable jsdoc/no-undefined-types */
		/**
		 * Extensions layered on top of CodeMirror's defaults.
		 *
		 * @return {Extension}
		 */
		/* eslint-enable jsdoc/no-undefined-types */
		function editorExtensions() {
			const { Compartment, EditorState, EditorView, Prec, placeholder } = lib;
			readOnlyCompartment = new Compartment();
			editableCompartment = new Compartment();
			placeholderCompartment = new Compartment();

			return [
				// Must outrank CodeMirror's own read-only state, which it takes from
				// the textarea and which also blocks the changes we dispatch ourselves.
				Prec.highest(
					readOnlyCompartment.of( EditorState.readOnly.of( isReadOnly.value ) )
				),
				editableCompartment.of( EditorView.editable.of( !props.disabled ) ),
				placeholderCompartment.of(
					props.placeholder ? placeholder( props.placeholder ) : []
				),
				EditorView.updateListener.of( ( update ) => {
					if ( update.docChanged ) {
						emit( 'update:modelValue', update.state.doc.toString() );
					}
				} )
			];
		}

		/**
		 * Load the mode and create the editor.
		 *
		 * @return {Promise<void>}
		 */
		async function createEditor() {
			const id = ++loadId;
			let langSupport;

			try {
				langSupport = await loadLanguageSupport( props.mode, props.modeConfig );
			} catch ( error ) {
				// Stay silent about a load we no longer need.
				if ( id !== loadId ) {
					return;
				}
				mw.log.error( error );
				emit( 'error', error );
				return;
			}

			// The component may have unmounted, or the mode changed, while loading.
			if ( id !== loadId || !textarea.value ) {
				return;
			}

			const CodeMirror = require( 'ext.CodeMirror' );
			lib = require( 'ext.CodeMirror.lib' );

			// TODO: The core class reads read-only once, then blocks all document changes,
			// including the ones we dispatch for modelValue. editorExtensions() applies it
			// instead. Make the core state a compartment in a later patch and remove this.
			textarea.value.readOnly = false;

			codeMirror = new CodeMirror( textarea.value, langSupport );
			// An embedded editor shouldn't take focus unless it was asked to,
			// and multiple editors on a page would otherwise compete for it.
			codeMirror.preferences.lockPreference( 'autofocus', undefined, props.autofocus );
			if ( props.theme ) {
				codeMirror.preferences.lockPreference( 'theme', undefined, props.theme );
			}
			codeMirror.initialize( [ codeMirror.defaultExtensions, editorExtensions() ] );

			emit( 'ready', codeMirror );
		}

		/**
		 * Destroy the editor, restoring the plain textarea.
		 */
		function destroyEditor() {
			loadId++;
			if ( !codeMirror ) {
				return;
			}
			codeMirror.destroy();
			codeMirror = null;
			if ( textarea.value ) {
				textarea.value.readOnly = isReadOnly.value;
			}
		}

		/**
		 * Handle input on the plain textarea, shown until the editor is ready.
		 *
		 * @param {InputEvent} event
		 */
		function onTextareaInput( event ) {
			emit( 'update:modelValue', event.target.value );
		}

		watch( () => props.modelValue, ( newValue ) => {
			// Anything the user typed is already in the document, so this only
			// runs for changes that came from outside the editor.
			if ( !codeMirror || !codeMirror.view ||
				newValue === codeMirror.view.state.doc.toString()
			) {
				return;
			}
			const { anchor, head } = codeMirror.view.state.selection.main;
			codeMirror.view.dispatch( {
				changes: {
					from: 0,
					to: codeMirror.view.state.doc.length,
					insert: newValue
				},
				selection: {
					anchor: Math.min( anchor, newValue.length ),
					head: Math.min( head, newValue.length )
				}
			} );
		} );

		watch( () => [ props.readOnly, props.disabled ], () => {
			if ( !codeMirror || !codeMirror.view ) {
				return;
			}
			const { EditorState, EditorView } = lib;
			codeMirror.view.dispatch( { effects: [
				readOnlyCompartment.reconfigure(
					EditorState.readOnly.of( isReadOnly.value )
				),
				editableCompartment.reconfigure(
					EditorView.editable.of( !props.disabled )
				)
			] } );
		} );

		watch( () => props.placeholder, ( newValue ) => {
			if ( !codeMirror || !codeMirror.view ) {
				return;
			}
			codeMirror.view.dispatch( {
				effects: placeholderCompartment.reconfigure(
					newValue ? lib.placeholder( newValue ) : []
				)
			} );
		} );

		// CodeMirror can't change language after construction, so start over.
		// Undo history and focus are lost, but the contents are kept.
		watch( () => props.mode, () => {
			destroyEditor();
			createEditor();
		} );

		onMounted( createEditor );
		onBeforeUnmount( destroyEditor );

		return {
			textarea,
			isReadOnly,
			rootClasses,
			onTextareaInput
		};
	}
} );
</script>

<style lang="less">
@import 'mediawiki.skin.variables.less';

.ext-codemirror-editor {
	&__textarea {
		box-sizing: border-box;
		width: 100%;
		font-family: monospace;
	}

	// CodeMirror themes paint the editor itself, so the disabled state can't
	// go on the container.
	&--disabled &__textarea,
	&--disabled .cm-editor {
		opacity: @opacity-medium;
	}
}
</style>
