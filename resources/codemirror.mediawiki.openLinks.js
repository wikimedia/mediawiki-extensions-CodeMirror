const {
	EditorView,
	Extension,
	ensureSyntaxTree
} = require( 'ext.CodeMirror.v6.lib' );
const mwModeConfig = require( './codemirror.mediawiki.config.js' );
const { platform } = $.client.profile();

const isMac = platform === 'mac' || platform === 'ipad' || platform === 'iphone',
	modKey = isMac ? 'Meta' : 'Control';

document.addEventListener( 'keydown', ( e ) => {
	if ( e.key !== modKey ) {
		return;
	}

	// Add .cm-mw-open-links from all CodeMirror instances.
	for ( const dom of document.querySelectorAll( '.cm-content' ) ) {
		dom.classList.add( 'cm-mw-open-links' );
	}
} );
document.addEventListener( 'keyup', ( e ) => {
	if ( e.key !== modKey ) {
		return;
	}

	// Remove .cm-mw-open-links from all CodeMirror instances.
	for ( const dom of document.querySelectorAll( '.cm-content' ) ) {
		dom.classList.remove( 'cm-mw-open-links' );
	}
} );

/**
 * CodeMirror extension that opens links by modifier-clicking for the MediaWiki mode.
 * This automatically applied when using {@link CodeMirrorModeMediaWiki}.
 *
 * @module CodeMirrorOpenLinks
 * @type {Extension}
 */
const openLinksExtension = [
	EditorView.domEventHandlers( {
		/**
		 * Handle the mousedown event to open links.
		 *
		 * @param {MouseEvent} e
		 * @param {EditorView} view
		 * @return {boolean}
		 * @private
		 */
		mousedown( e, view ) {
			if ( !( isMac ? e.metaKey : e.ctrlKey ) || e.button !== 0 ) {
				return false;
			}
			const position = view.posAtCoords( e );
			if ( !position ) {
				return false;
			}
			const { state } = view,
				tree = ensureSyntaxTree( state, position ),
				node = tree && tree.resolve( position, 1 );
			if ( !node ) {
				return false;
			}
			const { name, from, to } = node,
				names = name.split( '_' );
			if ( names.includes( mwModeConfig.tags.linkPageName ) ||
				names.includes( mwModeConfig.tags.templateName ) ) {
				let page = state.sliceDoc( from, to ).trim();
				if ( page.startsWith( '/' ) ) {
					page = `:${ mw.config.get( 'wgPageName' ) }${ page }`;
				}
				const ns = names.includes( mwModeConfig.tags.templateName ) ? 10 : 0,
					title = mw.Title.newFromText( page, ns );
				if ( title ) {
					open( title.getUrl(), '_blank' );
					return true;
				}
			} else if ( names.includes( mwModeConfig.tags.extLinkProtocol ) ||
				names.includes( mwModeConfig.tags.freeExtLinkProtocol ) ) {
				open( state.sliceDoc( from, node.nextSibling.to ), '_blank' );
				return true;
			} else if ( names.includes( mwModeConfig.tags.extLink ) ||
				names.includes( mwModeConfig.tags.freeExtLink ) ) {
				open( state.sliceDoc( node.prevSibling.from, to ), '_blank' );
				return true;
			} else if ( names.includes( mwModeConfig.tags.pageName ) &&
				names.includes( 'mw-ext-templatestyles' ) ) {
				const title = mw.Title.newFromText( state.sliceDoc( from, to ).trim(), 10 );
				if ( title ) {
					open( title.getUrl(), '_blank' );
					return true;
				}
			}
			return false;
		}
	} ),
	EditorView.contentAttributes.of( {
		'data-open-links': ''
	} )
];

module.exports = openLinksExtension;
