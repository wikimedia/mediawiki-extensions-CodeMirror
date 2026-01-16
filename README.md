The CodeMirror extension provides syntax highlighting in MediaWiki wikitext editors using
the [CodeMirror library](https://codemirror.net/).

Extension homepage:
[https://www.mediawiki.org/wiki/Extension:CodeMirror](https://www.mediawiki.org/wiki/Special:MyLanguage/Extension:CodeMirror)

JS documentation:
[https://doc.wikimedia.org/CodeMirror](https://doc.wikimedia.org/CodeMirror)

## Development

### Preface

Extension:CodeMirror is currently in the process of being upgraded to the new major version, CodeMirror 6.
See the [change log](https://www.mediawiki.org/wiki/Extension:CodeMirror#Change_log) for details.

Use of CodeMirror 6 is controlled by the `wgCodeMirrorV6` configuration setting, or by
passing in `cm6enable=1` in the URL query string.

CodeMirror 6 requires the use of NPM to bundle the dependencies. These are built using
[Rollup](https://rollupjs.org/) and packaged as ResourceLoader-compatible modules under `lib/`.
If you make changes to the versions of `@codemirror` or `@lezer` packages,
you will need to run `npm run build` to update the ResourceLoader modules.

### NPM commands

_NOTE: Consider using [Fresh](https://gerrit.wikimedia.org/g/fresh/) to run these tasks._

* `npm install` to install dependencies.
* `npm run doc` to generate the API documentation.
* `npm test` to run the linting tools, JavaScript unit tests, and build checks.
* `npm run test:lint` for linting of JS/LESS/CSS.
* `npm run test:lint:js` for linting of just JavaScript.
* `npm run test:lint:styles` for linting of just Less/CSS.
* `npm run test:i18n` for linting of i18n messages with banana-checker.
* `npm run test:unit` for the new Jest unit tests.
* `npm run selenium-test` for the Selenium tests.
* `npm run update-parser-tests` to update the Jest parser tests in
  `tests/jest/parser/tests.json` after making changes to the MediaWiki
  [Stream parser](resources/modes/mediawiki/codemirror.mediawiki.js).
* `npm run build` to rebundle the CodeMirror library. If changes are made to the `@codemirror`
  or `@lezer` dependencies in [package.json](package.json), this command *must* be run before
  sending the patch or CI will fail. This also calls the `build:eslint`,
  `build:stylelint`, and `build:luacheck` commands.
* `npm run build:eslint` to rebundle the ESLint library. If changes are made to the
  `@bhsd/eslint-browserify` dependency in [package.json](package.json) or the
  [JavaScript worker](resources/workers/javascript/worker.js), this command *must* be run
  before sending the patch.
* `npm run build:stylelint` to rebundle the Stylelint library. If changes are made to the
  `@bhsd/stylelint-browserify` dependency in [package.json](package.json) or the
  [CSS worker](resources/workers/css/worker.js), this command *must* be run before sending the
  patch.
* `npm run build:luacheck` to rebundle the LuaCheck library. If changes are made to the
  `luacheck-browserify` dependency in [package.json](package.json) or the
  [Lua worker](resources/workers/lua/worker.js), this command *must* be run before
  sending the patch.
* `npm run build:wikilint` to rebundle the WikiParser-Node library. If changes are made to the
  `wikiparser-node` dependency in [package.json](package.json) or the
  [MediaWiki worker](resources/workers/mediawiki/worker.js), this command *must* be run before
  sending the patch.
* Older QUnit tests are in `resources/mode/mediawiki/tests/qunit/`. These have been
  replaced and will be removed after the CodeMirror 6 upgrade is complete.
