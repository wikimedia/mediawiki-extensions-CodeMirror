/**
 * This file is managed by Rollup and bundles all the CodeMirror dependencies
 * into the single file resources/lib/codemirror.bundle.lib.js.
 */

/**
 * @module ext.CodeMirror.lib
 * @description
 * This module provides the core upstream CodeMirror library.
 * You shouldn't need to require this directly unless you want
 * access to the upstream {@link https://codemirror.net/docs/ref/ CodeMirror API}.
 * @example
 * await require = mw.loader.using( [ 'ext.CodeMirror', 'ext.CodeMirror.mode.mediawiki' ] );
 * const CodeMirror = require( 'ext.CodeMirror' );
 * const { mediawiki } = require( 'ext.CodeMirror.mode.mediawiki' );
 * // ext.CodeMirror.lib is a dependency of ext.CodeMirror, so it's already loaded.
 * const { EditorView } = require( 'ext.CodeMirror.lib' );
 * const myExtension = EditorView.updateListener.of( ( update ) => {
 *   if ( update.docChanged ) {
 *     // do something
 *     console.log( update.changes );
 *   }
 * } );
 * const cm = new CodeMirror( myTextarea, mediawiki() );
 * cm.initialize( [ cm.defaultExtensions, myExtension ] );
 */

/* eslint-disable es-x/no-export-ns-from */
export * from '@codemirror/autocomplete';
export * from '@codemirror/commands';
export * from '@codemirror/language';
export * from '@codemirror/lint';
export * from '@codemirror/search';
export * from '@codemirror/state';
export * from '@codemirror/theme-one-dark';
export * from '@codemirror/view';
export * from '@lezer/highlight';
