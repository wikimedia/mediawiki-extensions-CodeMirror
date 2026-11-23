const fs = require( 'fs' );
const path = require( 'path' );
const { CodeMirrorMediaWiki } = require( '../../../resources/modes/mediawiki/codemirror.mediawiki.js' );
const tests = require( '../parser/tests.json' );
const mwConfig = require( '../fixtures/mwConfig.json' );

const { parser } = new CodeMirrorMediaWiki( mwConfig ).language;

const results = [];
describe( 'Parser tests', () => {
	for ( const { desc, wikitext } of tests ) {
		it( desc, () => {
			const tree = parser.parse( wikitext ),
				nodes = [];
			tree.iterate( {
				enter( node ) {
					if ( node.name === 'Document' ) {
						return;
					}
					const name = node.name.replace( /_+/g, ' ' ).trim();
					if ( name ) {
						nodes.push( {
							text: wikitext.slice( node.from, node.to ),
							name
						} );
					}
				}
			} );
			const result = { desc, wikitext, nodes };
			results.push( result );
			try {
				expect( nodes ).toEqual( tests.find( ( { desc: d } ) => desc === d ).nodes );
			} catch ( e ) {
				e.cause = { message: `\n${ wikitext }` };
				throw e;
			}
		} );
	}
	afterAll( () => {
		if ( process.env.UPDATE_PARSER_TESTS ) {
			fs.writeFileSync(
				path.join( 'tests', 'jest', 'parser', 'tests.json' ),
				`${ JSON.stringify( results, null, '\t' ) }\n`
			);
		}
	} );
} );
