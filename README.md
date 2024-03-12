# mediawiki/extensions/CodeMirror

Homepage: https://www.mediawiki.org/wiki/Special:MyLanguage/Extension:CodeMirror

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
* `npm test` to run the linting tools, JavaScript unit tests, and build checks.
* `npm run test:lint` for linting of JS/LESS/CSS.
* `npm run test:lint:js` for linting of just JavaScript.
* `npm run test:lint:styles` for linting of just Less/CSS.
* `npm run test:i18n` for linting of i18n messages with banana-checker.
* `npm run test:unit` for the new Jest unit tests.
* `npm run selenium-test` for the Selenium tests.
* `npm run test:bundlesize` to test if the gzip'd entrypoint is of acceptable size.

Older QUnit tests are in `resources/mode/mediawiki/tests/qunit/`. These will
eventually be moved over to `tests/qunit` and rewritten for CodeMirror 6.

## CodeMirror 6 change log

This is a list of changes that either come by default with the CodeMirror 6 upgrade,
or changes of our that we deem as reasonable improvements.
Some may be removed pending user feedback:

### Upstream changes

* Bracket matching now highlights unmatched brackets in red

### New MediaWiki mode features

* Closing HTML tags that highlighted as an error now also highlight the closing '>'
* Allow link titles to be both emboldened and italicized.
* Wikitext syntax highlighting is shown on protected pages
  ([T301615](https://phabricator.wikimedia.org/T301615))

### Deprecations and other changes

* The `.cm-mw-mnemonic` CSS class has been renamed to `.cm-mw-html-entity`
* The `.cm-mw-template-name-mnemonic` class has been removed.
  Use `.cm-mw-template-ground.cm-html-entity` instead.
* Line-level styling for `<nowiki>`, `<pre>`, and any tag without an associated
  TagMode has been removed.
* The browser's native search functionality (ala Ctrl+F) has been replaced with
  search functionality built into CodeMirror. This is necessary to maintain
  performance (see [T303664](https://phabricator.wikimedia.org/T303664)).
