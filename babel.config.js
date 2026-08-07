'use strict';

// Used only by Jest, to transform .vue single-file components.
module.exports = {
	presets: [
		[ '@babel/preset-env', { targets: { node: 'current' } } ]
	]
};
