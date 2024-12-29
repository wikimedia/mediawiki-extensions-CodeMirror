describe( 'CodeMirror.init.js', () => {
	it( 'should load only ext.WikiEditor for read-only pages with usebetatoolbar=1', () => {
		mw.config.get = jest.fn().mockImplementation( ( key ) => {
			if ( key === 'cmRLModules' ) {
				return [ 'ext.CodeMirror.v6' ];
			} else if ( key === 'cmReadOnly' ) {
				return true;
			}
		} );
		mw.user.options.get = jest.fn().mockImplementation( ( key ) => {
			if ( key === 'usecodemirror' ) {
				return 0;
			} else if ( key === 'usebetatoolbar' ) {
				return 1;
			}
		} );
		const spy = jest.spyOn( mw.loader, 'load' );
		require( '../../resources/codemirror.init.js' );
		expect( spy ).toHaveBeenCalledWith( 'ext.wikiEditor' );
	} );
} );
