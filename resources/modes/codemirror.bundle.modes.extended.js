/**
 * This file is managed by Rollup and bundles all the listed dependencies
 * into the single file resources/lib/codemirror.bundle.modes.extended.js.
 *
 * Every language here is downloaded by anyone using any language in this module,
 * so state the gzipped cost in the commit message before adding one.
 */

/* eslint-disable es-x/no-export-ns-from */
export * from '@codemirror/lang-angular';
export * from '@codemirror/lang-cpp';
export * from '@codemirror/lang-go';
export * from '@codemirror/lang-java';
export * from '@codemirror/lang-less';
export * from '@codemirror/lang-liquid';
export * from '@codemirror/lang-markdown';
export * from '@codemirror/lang-php';
export * from '@codemirror/lang-python';
export * from '@codemirror/lang-rust';
export * from '@codemirror/lang-sass';
export * from '@codemirror/lang-sql';
export * from '@codemirror/lang-wast';
export * from '@codemirror/lang-xml';
export * from '@codemirror/lang-yaml';
// Exports only `parser`, which collides with other grammars and would be dropped.
export { parser as mustacheParser } from '@grumptech/lezer-mustache';
export * from '@plutojl/lang-julia';
export * from '@replit/codemirror-lang-nix';
export * from '@xiechao/codemirror-lang-handlebars';
export * from 'codemirror-lang-elixir';
export * from 'codemirror-lang-pkl';
export * from 'codemirror-lang-r';
export * from 'codemirror-lang-sparql';
