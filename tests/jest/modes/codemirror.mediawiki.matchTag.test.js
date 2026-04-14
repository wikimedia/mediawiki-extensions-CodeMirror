/* eslint-disable-next-line n/no-missing-require */
const { syntaxTree } = require( 'ext.CodeMirror.lib' );
const CodeMirror = require( '../../../resources/codemirror.js' );
const { mediawiki } = require( '../../../resources/modes/mediawiki/codemirror.mediawiki.js' );
const { getTag } = require( '../../../resources/modes/mediawiki/codemirror.mediawiki.matchTag.js' );
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
} );
