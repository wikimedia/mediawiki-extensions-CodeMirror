'use strict';

module.exports = function ( grunt ) {
	grunt.loadNpmTasks( 'grunt-banana-checker' );
	grunt.loadNpmTasks( 'grunt-eslint' );
	grunt.loadNpmTasks( 'grunt-stylelint' );

	grunt.initConfig( {
		eslint: {
			options: {
				cache: true,
				fix: grunt.option( 'fix' )
			},
			all: [
				'**/*.{js,json}',
				'!resources/lib/**',
				'!{vendor,node_modules}/**'
			]
		},
		stylelint: {
			all: [
				'**/*.{css,less}',
				'!resources/lib/**',
				'!node_modules/**',
				'!vendor/**',
				'resources/lib/codemirror-fixes.less'
			]
		},
		banana: {
			all: 'i18n/'
		}
	} );

	grunt.registerTask( 'test', [ 'eslint', 'stylelint', 'banana' ] );
	grunt.registerTask( 'default', 'test' );
};
