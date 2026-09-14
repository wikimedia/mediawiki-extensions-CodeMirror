const { EditorView, Extension } = require( 'ext.CodeMirror.lib' );
const { platform } = $.client.profile();

const isMac = platform === 'mac' || platform === 'ipad' || platform === 'iphone',
	modKey = isMac ? 'Meta' : 'Control';

/**
 * Toggle .cm-mw-open-links from all CodeMirror instances.
 *
 * @param {boolean} toggle
 * @private
 */
function toggleOpenLinks( toggle ) {
	for ( const dom of document.querySelectorAll( '.cm-content' ) ) {
		// Use .add() and .remove() instead of .toggle() for safe measure.
		dom.classList[ toggle ? 'add' : 'remove' ]( 'cm-mw-open-links' );
	}
}

document.addEventListener( 'keydown', ( e ) => {
	if ( e.key === modKey ) {
		toggleOpenLinks( true );
	}
} );
document.addEventListener( 'keyup', ( e ) => {
	if ( e.key === modKey ) {
		toggleOpenLinks( false );
	}
} );
// Ensure openLinks classes are removed when switching tabs.
document.addEventListener( 'visibilitychange', () => {
	if ( document.hidden ) {
		toggleOpenLinks( false );
	}
} );

/**
 * Whether an event carries the platform's open-links modifier.
 *
 * @param {MouseEvent|KeyboardEvent} e
 * @return {boolean}
 * @internal
 * @private
 */
function hasOpenLinksModifier( e ) {
	return isMac ? e.metaKey : e.ctrlKey;
}

/**
 * CodeMirror extension that opens links by modifier-clicking.
 *
 * @param {Function} resolveLinkAt Function that returns a link at a position, or null if none.
 * @return {Extension}
 * @internal
 * @private
 */
const getOpenLinksExtension = ( resolveLinkAt ) => [
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
			if ( !hasOpenLinksModifier( e ) || e.button !== 0 ) {
				return false;
			}
			const position = view.posAtCoords( e );
			if ( !position ) {
				return false;
			}
			const link = resolveLinkAt( view.state, position );
			if ( !link ) {
				return false;
			}
			open( link.url, '_blank', 'noopener noreferrer' );
			return true;
		}
	} ),
	EditorView.contentAttributes.of( {
		'data-open-links': ''
	} )
];

module.exports = {
	modKey,
	hasOpenLinksModifier,
	getOpenLinksExtension
};
