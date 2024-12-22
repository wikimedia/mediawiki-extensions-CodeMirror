const {
	EditorView,
	Extension,
	ensureSyntaxTree
} = require( 'ext.CodeMirror.v6.lib' );
const mwModeConfig = require( './codemirror.mediawiki.config.js' );
const { platform } = $.client.profile();

const isMac = platform === 'mac' || platform === 'ipad' || platform === 'iphone',
	modKey = isMac ? 'Meta' : 'Control';

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
			return false;
		},
		/**
		 * Add the `.cm-mw-open-links` CSS class to the editor when the mod key is pressed.
		 *
		 * @param {KeyboardEvent} e
		 * @private
		 */
		keydown( e ) {
			if ( e.key !== modKey ) {
				return;
			}

			// Add .cm-mw-open-links from all CodeMirror instances.
			for ( const dom of document.querySelectorAll( '.cm-content' ) ) {
				dom.classList.add( 'cm-mw-open-links' );
			}
		},
		/**
		 * Remove `.cm-mw-open-link` when the modifier key is released.
		 *
		 * @param {KeyboardEvent} e
		 * @private
		 */
		keyup( e ) {
			if ( e.key !== modKey ) {
				return;
			}

			// Remove .cm-mw-open-links from all CodeMirror instances.
			for ( const dom of document.querySelectorAll( '.cm-content' ) ) {
				dom.classList.remove( 'cm-mw-open-links' );
			}
		}
	} )
];

module.exports = openLinksExtension;
