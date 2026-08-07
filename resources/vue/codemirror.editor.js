/**
 * @module ext.CodeMirror.VueComponent
 * @description
 * This module provides a Vue component that wraps the {@link CodeMirror} class.
 * The ResourceLoader module for the requested language mode is loaded on demand,
 * so the only dependency you need to declare is this one.
 *
 * The contents of the editor are bound with `v-model`.
 *
 * **Props:**
 *
 * * `modelValue` {string} Contents of the editor.
 * * `mode` {string} Language mode, i.e. `javascript`, `python` or `mediawiki`.
 * * `modeConfig` {Object} Configuration for the mode, read only when the editor
 *   is created. Only the `mediawiki` mode uses this.
 * * `readOnly` {boolean} Make the contents read-only, but still selectable.
 * * `disabled` {boolean} Make the contents read-only and not focusable.
 * * `placeholder` {string} Shown while the editor is empty.
 * * `rows` {number} Initial height of the editor, in rows.
 * * `autofocus` {boolean} Focus the editor once it is ready.
 * * `theme` {string} Theme name, overriding the user's preference. Read only when
 *   the editor is created.
 *
 * **Events:**
 *
 * * `update:modelValue` {string}
 * * `ready` {CodeMirror} The instance, for use with
 *   {@link CodeMirror#applyExtension applyExtension()} and
 *   {@link CodeMirror#applyLinter applyLinter()}.
 * * `error` {Error} The mode is unknown, or its module failed to load.
 * * `focus`, `blur` {FocusEvent}
 *
 * Changing `mode` rebuilds the editor, which keeps the contents but loses the
 * undo history and focus.
 * @example
 * // Add 'ext.CodeMirror.VueComponent' to your module's dependencies.
 * const CodeMirrorEditor = require( 'ext.CodeMirror.VueComponent' );
 *
 * // <code-mirror-editor v-model="code" mode="python"></code-mirror-editor>
 * @see CodeMirror
 */
module.exports = require( './CodeMirrorEditor.vue' );
