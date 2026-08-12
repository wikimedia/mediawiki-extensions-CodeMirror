/**
 * This file is managed by Rollup and bundles all the listed dependencies
 * into the single file resources/lib/codemirror.bundle.modes.extended.js.
 *
 * Every language here is downloaded by anyone using any language in this module,
 * so state the gzipped cost in the commit message before adding one.
 */

export { angular } from '@codemirror/lang-angular';
export { cpp } from '@codemirror/lang-cpp';
export { go } from '@codemirror/lang-go';
export { java } from '@codemirror/lang-java';
export { less } from '@codemirror/lang-less';
export { liquid } from '@codemirror/lang-liquid';
export { markdown } from '@codemirror/lang-markdown';
export { php } from '@codemirror/lang-php';
export { python } from '@codemirror/lang-python';
export { rust } from '@codemirror/lang-rust';
export { sass } from '@codemirror/lang-sass';
export { sql } from '@codemirror/lang-sql';
export { wast } from '@codemirror/lang-wast';
export { xml } from '@codemirror/lang-xml';
export { yaml } from '@codemirror/lang-yaml';
// Exports only `parser`, which collides with other grammars and would be dropped.
export { parser as mustacheParser } from '@grumptech/lezer-mustache';
export { julia } from '@plutojl/lang-julia';
export { nix } from '@replit/codemirror-lang-nix';
export { handlebarsLanguage } from '@xiechao/codemirror-lang-handlebars';
export { elixir } from 'codemirror-lang-elixir';
export { pkl } from 'codemirror-lang-pkl';
export { r } from 'codemirror-lang-r';
export { sparql } from 'codemirror-lang-sparql';
