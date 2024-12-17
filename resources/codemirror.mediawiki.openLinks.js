const {
	EditorView,
	Extension,
	ensureSyntaxTree
} = require( 'ext.CodeMirror.v6.lib' );
const mwModeConfig = require( './codemirror.mediawiki.config.js' );

const { platform } = $.client.profile(),
	modKey = platform === 'mac' || platform === 'ipad' || platform === 'iphone' ? 'metaKey' : 'ctrlKey',
	linkTypes = [ 'template-name', 'link-pagename', 'extlink-protocol', 'extlink', 'free-extlink-protocol', 'free-extlink' ];

/**
 * CodeMirror extension that opens links by modifier-clicking for the MediaWiki mode.
 * This automatically applied when using {@link CodeMirrorModeMediaWiki}.
 *
 * @module CodeMirrorOpenLinks
 * @type {Extension}
 */
const openLinksExtension = [
	EditorView.domEventHandlers( {
		mousedown( e, view ) {
			if ( !e[ modKey ] || e.button !== 0 ) {
				return;
			}
			const position = view.posAtCoords( e );
			if ( !position ) {
				return;
			}
			const { state } = view,
				tree = ensureSyntaxTree( state, position ),
				node = tree && tree.resolve( position, 1 );
			if ( !node ) {
				return;
			}
			const { name, from, to } = node,
				names = name.split( '_' );
			if ( names.includes( mwModeConfig.tags.linkPageName ) ||
				names.includes( mwModeConfig.tags.templateName ) ) {
				let page = state.sliceDoc( from, to ).trim();
				if ( page.startsWith( '/' ) ) {
					page = `:${ mw.config.get( 'wgPageName' ) }${ page }`;
				}
				const ns = names.includes( mwModeConfig.tags.templateName ) ? 10 : 0;
				open( new mw.Title( page, ns ).getUrl(), '_blank' );
				return true;
			} else if ( names.includes( mwModeConfig.tags.extLinkProtocol ) ||
				names.includes( mwModeConfig.tags.freeExtLinkProtocol ) ) {
				open( state.sliceDoc( from, node.nextSibling.to ), '_blank' );
				return true;
			} else if ( names.includes( mwModeConfig.tags.extLink ) ||
				names.includes( mwModeConfig.tags.freeExtLink ) ) {
				open( state.sliceDoc( node.prevSibling.from, to ), '_blank' );
				return true;
			}
		}
	} ),
	EditorView.theme( {
		[ linkTypes.map( ( type ) => `.cm-mw-${ type }` ).join() ]: {
			cursor: 'pointer'
		}
	} )
];

module.exports = openLinksExtension;
