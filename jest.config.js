'use strict';

module.exports = {
	// Automatically clear mock calls and instances between every test
	clearMocks: true,

	// Indicates whether the coverage information should be collected while executing the test
	collectCoverage: true,

	// An array of glob patterns indicating a set of files fo
	//  which coverage information should be collected
	collectCoverageFrom: [
		'tests/jest/*.js'
	],

	// The directory where Jest should output its coverage files
	coverageDirectory: 'coverage',

	// An array of regexp pattern strings used to skip coverage collection
	coveragePathIgnorePatterns: [
		'/node_modules/'
	],

	// An object that configures minimum threshold enforcement for coverage results
	coverageThreshold: {
		global: {
			branches: 31,
			functions: 39,
			lines: 38,
			statements: 38
		}
	},

	// An array of file extensions your modules use
	moduleFileExtensions: [
		'js'
	],

	// The paths to modules that run some code to configure or
	// set up the testing environment before each test
	setupFiles: [
		'./tests/jest/setup.js'
	],

	// Simulates a real browser environment.
	testEnvironment: 'jsdom',

	// Ignore these directories when locating tests to run.
	testPathIgnorePatterns: [
		'<rootDir>/node_modules/',
		'<rootDir>/resources/'
	]
};
