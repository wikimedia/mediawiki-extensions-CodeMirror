const { json, jsonParseLinter } = require( '../lib/codemirror6.bundle.json.js' );

const lintSource = jsonParseLinter();

module.exports = {
	json() {
		const extension = json();
		extension.lintSource = lintSource;
		return extension;
	}
};
