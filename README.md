The CodeMirror extension provides syntax highlighting in MediaWiki wikitext editors using
the [CodeMirror library](https://codemirror.net/).

CodeMirror 6 homepage: [https://www.mediawiki.org/wiki/Extension:CodeMirror/6](https://www.mediawiki.org/wiki/Extension:CodeMirror/6)

JS documentation: [https://doc.wikimedia.org/CodeMirror](https://doc.wikimedia.org/CodeMirror)

## Development

### Preface

Extension:CodeMirror is currently in the process of being upgraded to the new major version, CodeMirror 6.
See the [change log](https://www.mediawiki.org/wiki/Extension:CodeMirror/6#Change_log) for details.

Use of CodeMirror 6 is controlled by the `wgCodeMirrorV6` configuration setting, or by
passing in `cm6enable=1` in the URL query string.

CodeMirror 6 requires the use of NPM to bundle the dependencies. These are bundled in
[resources/codemirror.bundle.js](resources/codemirror.bundle.js), built using [Rollup](https://rollupjs.org/),
and packaged as the `ext.CodeMirror.v6.lib` ResourceLoader module. If you make changes to the
versions of the dependencies, you will need to run `npm run build` to update the ResourceLoader module.

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
* `npm run build` to rebundle the CodeMirror library. If changes are made to the `@codemirror`
  or `@lezer` dependencies in [package.json](package.json), this command *must* be run before
  sending the patch or CI will fail.
* Older QUnit tests are in `resources/mode/mediawiki/tests/qunit/`. These have been
  replaced and will be removed after the CodeMirror 6 upgrade is complete.
