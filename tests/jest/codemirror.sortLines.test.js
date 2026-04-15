// eslint-disable-next-line n/no-missing-require
const { EditorState, EditorSelection } = require( 'ext.CodeMirror.lib' );
const CodeMirrorSortLines = require( '../../resources/codemirror.sortLines.js' );

describe( 'codemirror.sortLines', () => {
	let sortLines, mockView;

	beforeEach( () => {
		sortLines = new CodeMirrorSortLines();
	} );

	function runCommand( doc, ascending = true, selection = EditorSelection.single( 0 ) ) {
		const state = EditorState.create( {
			doc,
			selection,
			extensions: [ EditorState.allowMultipleSelections.of( true ) ]
		} );
		mockView = {
			state,
			dispatch: ( tr ) => {
				mockView.state = mockView.state.update( tr ).state;
			}
		};
		if ( ascending ) {
			sortLines.sortAscending( mockView );
		} else {
			sortLines.sortDescending( mockView );
		}
		return mockView.state.doc.toString();
	}

	it( 'sorts selected lines only', () => {
		const doc = 'zebra\nbanana\nApple\ncherry\nkiwi';
		const selection = EditorSelection.single( 6, 24 );
		expect( runCommand( doc, true, selection ) )
			.toBe( 'zebra\nApple\nbanana\ncherry\nkiwi' );
	} );

	it( 'puts newlines first when sorting ascending, except the trailing newline', () => {
		const doc = 'banana\nApple\ncherry\n\n\n';
		const selection = EditorSelection.single( 0, doc.length );
		expect( runCommand( doc, true, selection ) )
			.toBe( '\n\nApple\nbanana\ncherry\n' );
	} );

	it( 'works with multiple ranges', () => {
		const doc = 'cherry\nbanana\nApple\n\n\nuntouched\n\n\norange\nmango\nkiwi\n\n\n';
		const selection = EditorSelection.create( [
			// Targets 'cherry\nbanana\nApple\n\n'
			EditorSelection.range( 0, 22 ),
			// Targets 'orange\nmango\nkiwi\n\n'
			EditorSelection.range( 34, 54 )
		] );
		const newDoc = runCommand( doc, true, selection );
		expect( newDoc ).toBe(
			'\n\nApple\nbanana\ncherry\nuntouched\n\n\n\n\nkiwi\nmango\norange\n'
		);
		sortLines.sortDescending( mockView );
		expect( mockView.state.doc.toString() )
			.toBe( 'cherry\nbanana\nApple\n\n\nuntouched\n\n\norange\nmango\nkiwi\n\n\n' );
	} );

	it( 'exposes configurable collation options', () => {
		expect( sortLines.options ).toMatchObject( { sensitivity: 'base' } );
		sortLines.setOptions( { sensitivity: 'accent' } );
		expect( sortLines.options ).toMatchObject( { sensitivity: 'accent' } );
		sortLines.resetOptions();
		expect( sortLines.options ).toMatchObject( { sensitivity: 'base' } );
	} );
} );
