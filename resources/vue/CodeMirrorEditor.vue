<template>
	<div
		class="ext-codemirror-editor"
		:class="[ rootClasses, $attrs.class ]"
		:style="[ $attrs.style, heightStyle ]"
		:data-testid="$attrs[ 'data-testid' ]"
	>
		<!-- CodeMirror moves this textarea into a wrapper of its own, so nothing
			else may be rendered inside this container. -->
		<div class="ext-codemirror-editor__container">
			<textarea
				ref="textarea"
				v-bind="textareaAttrs"
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
		/** Height of the editor, in rows. The smallest height when it grows. */
		rows: { type: Number, default: 10 },
		/** Grow with the contents instead of keeping one height. */
		autoHeight: { type: Boolean },
		/** Largest height in rows before the editor scrolls. Makes it grow. */
		maxRows: { type: Number, default: 0 },
		/** Focus the editor once it is ready. */
		autofocus: { type: Boolean },
		/** Theme name, overriding the user's preference. */
		theme: { type: String, default: null },
		/** Force the compact panel design, overriding the user's preference. */
		compact: { type: Boolean }
	},

	emits: [ 'update:modelValue', 'ready', 'error', 'focus', 'blur' ],

	setup( props, { attrs, emit } ) {
		const textarea = ref( null );
		let codeMirror = null;
		let lib = null;
		let editableCompartment = null;
		let placeholderCompartment = null;
		// Bumped whenever an in-flight load should be abandoned.
		let loadId = 0;

		// CodeMirror measures this once the editor exists. Rows mean nothing in CSS,
		// so we need it to turn the row counts into a height.
		const lineHeight = ref( 0 );

		const isReadOnly = computed( () => props.readOnly || props.disabled );
		const growsWithContent = computed( () => props.autoHeight || props.maxRows > 0 );
		const rootClasses = computed( () => ( {
			'ext-codemirror-editor--disabled': props.disabled,
			'ext-codemirror-editor--auto-height': growsWithContent.value
		} ) );
		const heightStyle = computed( () => {
			if ( !growsWithContent.value || !lineHeight.value ) {
				return null;
			}
			const style = {
				'--ext-codemirror-editor-min-height': `${ props.rows * lineHeight.value }px`
			};
			if ( props.maxRows ) {
				style[ '--ext-codemirror-editor-max-height' ] =
					`${ props.maxRows * lineHeight.value }px`;
			}
			return style;
		} );
		// These name the component as a whole, so they stay on the root. CodeMirror
		// hides the textarea, which would make a class or a test hook useless there.
		const rootAttrs = [ 'class', 'style', 'data-testid' ];
		const textareaAttrs = computed( () => {
			const rest = Object.assign( {}, attrs );
			for ( const name of rootAttrs ) {
				delete rest[ name ];
			}
			return rest;
		} );

		/* eslint-disable jsdoc/no-undefined-types */
		/**
		 * Extensions layered on top of CodeMirror's defaults.
		 *
		 * @return {Extension}
		 */
		/* eslint-enable jsdoc/no-undefined-types */
		function editorExtensions() {
			const { Compartment, EditorView, placeholder } = lib;
			editableCompartment = new Compartment();
			placeholderCompartment = new Compartment();

			return [
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

			codeMirror = new CodeMirror( textarea.value, langSupport );
			// An embedded editor shouldn't take focus unless it was asked to,
			// and multiple editors on a page would otherwise compete for it.
			codeMirror.preferences.lockPreference( 'autofocus', undefined, props.autofocus );
			if ( props.theme ) {
				codeMirror.preferences.lockPreference( 'theme', undefined, props.theme );
			}
			if ( props.compact ) {
				codeMirror.preferences.lockPreference( 'compactPanels', undefined, true );
			}
			codeMirror.initialize( [ codeMirror.defaultExtensions, editorExtensions() ] );
			lineHeight.value = codeMirror.view.defaultLineHeight;

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
			codeMirror.readOnly = isReadOnly.value;
			codeMirror.view.dispatch( {
				effects: editableCompartment.reconfigure(
					lib.EditorView.editable.of( !props.disabled )
				)
			} );
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
			heightStyle,
			textareaAttrs,
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

	// The core class gives the editor one fixed height, taken from the textarea.
	// Two classes outrank the theme that sets it, so the editor can grow instead.
	&--auto-height {
		.cm-editor {
			height: auto;
			min-height: var( --ext-codemirror-editor-min-height );
			max-height: var( --ext-codemirror-editor-max-height, none );
		}

		.cm-scroller {
			overflow: auto;
		}
	}

	// CodeMirror themes paint the editor itself, so the disabled state can't
	// go on the container.
	&--disabled &__textarea,
	&--disabled .cm-editor {
		opacity: @opacity-medium;
	}
}
</style>
