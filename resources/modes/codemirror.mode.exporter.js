module.exports = {};

for ( const mode of [ 'javascript', 'json', 'css', 'lua' ] ) {
	module.exports[ mode ] = function () {
		// eslint-disable-next-line security/detect-non-literal-require
		const ModeClass = require( `./codemirror.${ mode }.js` );
		return new ModeClass( mode );
	};
}
