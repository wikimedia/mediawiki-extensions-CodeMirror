/* eslint-disable-next-line n/no-missing-require */
const { syntaxTree } = require( 'ext.CodeMirror.lib' );
const CodeMirror = require( '../../../resources/codemirror.js' );
const { mediawiki } = require( '../../../resources/modes/mediawiki/codemirror.mediawiki.js' );
const { getTag, matchTag } = require( '../../../resources/modes/mediawiki/codemirror.mediawiki.matchTag.js' );
const mwModeConfig = require( '../../../resources/modes/mediawiki/codemirror.mediawiki.config.js' );

describe( 'CodeMirrorMatchTag', () => {
	const textarea = document.createElement( 'textarea' ),
		cm = new CodeMirror( textarea, mediawiki() );
	cm.initialize();

	const getTagTest = ( doc, pos, name, range ) => {
		cm.textSelection.setContents( doc );
		const node = syntaxTree( cm.view.state ).resolveInner( pos, 1 ),
			tag = getTag( cm.view.state, node );
		expect( node.name.split( '_' ) ).toContain( mwModeConfig.tags[ name ] );
		expect( tag && [ tag.from, tag.to ] ).toEqual( range );
	};

	const matchTagTest = ( doc, pos, result ) => {
		cm.textSelection.setContents( doc );
		const match = matchTag( cm.view.state, pos );
		expect( match ).toEqual( result );
	};

	/* eslint-disable jest/expect-expect */
	it( 'should not get a tag', () => {
		getTagTest( '[[a]]<p>', 4, 'linkBracket', null );
		getTagTest( '<ref/>{{b}}', 6, 'templateBracket', null );
	} );

	it( 'should not get a tag at the bracket', () => {
		getTagTest( '<p>', 0, 'htmlTagBracket', null );
		getTagTest( '<ref></ref>', 5, 'extTagBracket', null );
	} );

	it( 'should not get an incomplete tag', () => {
		getTagTest( '<p id=', 3, 'htmlTagAttribute', null );
		getTagTest( '<ref name=', 5, 'extTagAttribute', null );
	} );

	it( 'should get a tag at the tag name', () => {
		getTagTest( '<p id="a">', 1, 'htmlTagName', [ 0, 10 ] );
		getTagTest( '<ref name="b"/>', 2, 'extTagName', [ 0, 15 ] );
	} );

	it( 'should get a tag at the tag attribute', () => {
		getTagTest( '<p id="a">', 4, 'htmlTagAttribute', [ 0, 10 ] );
		getTagTest( '<ref name="b"/>', 7, 'extTagAttribute', [ 0, 15 ] );
	} );

	it( 'should get a tag at the tag attribute value', () => {
		getTagTest( '<p id="a">', 8, 'htmlTagAttributeValue', [ 0, 10 ] );
		getTagTest( '<ref name="b"/>', 11, 'extTagAttributeValue', [ 0, 15 ] );
		getTagTest( '<templatestyles src="c.css" />', 22, 'extTagAttributeValue', [ 0, 30 ] );
	} );

	it( 'should match a void extension tag', () => {
		matchTagTest( '<ref name="a"/>', 1, {
			matched: true, start: { from: 1, to: 4 }
		} );
	} );

	it( 'should match an opening extension tag', () => {
		matchTagTest( '<pre>a</pre>', 1, {
			matched: true, start: { from: 1, to: 4 }, end: { from: 8, to: 11 }
		} );
	} );

	it( 'should match a closing extension tag', () => {
		matchTagTest( '<pre>a</pre>', 8, {
			matched: true, start: { from: 8, to: 11 }, end: { from: 1, to: 4 }
		} );
	} );

	it( 'should not match an opening extension tag', () => {
		matchTagTest( '<pre>', 1, {
			matched: false, start: { from: 1, to: 4 }
		} );
	} );

	it( 'should match a void HTML tag', () => {
		matchTagTest( '<br>', 1, {
			matched: true, start: { from: 1, to: 3 }
		} );
	} );

	it( 'should match opening HTML tags', () => {
		matchTagTest( '<span><span></span></span>', 1, {
			matched: true, start: { from: 1, to: 5 }, end: { from: 21, to: 25 }
		} );
		matchTagTest( '<span><span></span></span>', 7, {
			matched: true, start: { from: 7, to: 11 }, end: { from: 14, to: 18 }
		} );
	} );

	it( 'should match a closing HTML tag', () => {
		matchTagTest( '<span><span></span></span>', 21, {
			matched: true, start: { from: 21, to: 25 }, end: { from: 1, to: 5 }
		} );
		matchTagTest( '<span><span></span></span>', 14, {
			matched: true, start: { from: 14, to: 18 }, end: { from: 7, to: 11 }
		} );
	} );

	it( 'should not match an opening HTML tag', () => {
		matchTagTest( '<span><span></span>', 1, {
			matched: false, start: { from: 1, to: 5 }
		} );
	} );

	it( 'should not match an invalid self-closing HTML tag', () => {
		matchTagTest( '<p/>', 1, {
			matched: false, start: { from: 1, to: 2 }
		} );
	} );
} );
