CodeMirror 6 homepage: [https://www.mediawiki.org/wiki/Extension:CodeMirror/6](https://www.mediawiki.org/wiki/Extension:CodeMirror/6)

## Development

As part of the [upgrade to CodeMirror 6](https://phabricator.wikimedia.org/T259059),
CodeMirror now uses an asset bundler, so during development you'll need to run a script
to assemble the frontend assets.

Use of CodeMirror 6 is controlled by the `wgCodeMirrorV6` configuration setting, or by
passing in `cm6enable=1` in the URL query string.

You can find the v6 frontend source files in `src/`, the compiled sources in
`resources/dist/`, and other frontend assets managed by ResourceLoader in
`resources/*`.

### Commands

_NOTE: Consider using [Fresh](https://gerrit.wikimedia.org/g/fresh/) to run these tasks._

* `npm install` to install dependencies.
* `npm start` to run the bundler in watch mode, reassembling the files on file change.
  You'll want to keep this running in a separate terminal during development.
* `npm run build` to compile the production assets. You *must* run this step before
  sending the patch or CI will fail (so that sources and built assets are in sync).
* `npm run doc` to generate the API documentation.
* `npm test` to run the linting tools, JavaScript unit tests, and build checks.
* `npm run test:lint` for linting of JS/LESS/CSS.
* `npm run test:lint:js` for linting of just JavaScript.
* `npm run test:lint:styles` for linting of just Less/CSS.
* `npm run test:i18n` for linting of i18n messages with banana-checker.
* `npm run test:unit` for the new Jest unit tests.
* `npm run selenium-test` for the Selenium tests.
* Older QUnit tests are in `resources/mode/mediawiki/tests/qunit/`. These have been
  replaced and will be removed after the CodeMirror 6 upgrade.

## CodeMirror 6 change log

* See [Extension:CodeMirror/6](https://www.mediawiki.org/wiki/Special:MyLanguage/Extension:CodeMirror/6#Differences_from_CodeMirror_5)
