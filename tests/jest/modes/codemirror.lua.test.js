const { lua } = require( '../../../resources/modes/codemirror.mode.exporter.js' );

describe( 'CodeMirrorLua', () => {
	it( 'has both a client-side and an API-powered linter', () => {
		const mode = lua();
		expect( mode.lintSource ).toBeInstanceOf( Function );
		expect( mode.lintApi ).toBeInstanceOf( Function );
	} );

	it( 'names both linters', () => {
		const mode = lua();
		expect( mode.lintSourceLabel ).toBe( 'codemirror-prefs-lint-luacheck' );
		expect( mode.lintApiLabel ).toBe( 'codemirror-prefs-lint-scribunto' );
	} );
} );
