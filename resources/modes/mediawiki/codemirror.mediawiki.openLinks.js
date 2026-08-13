const {
	EditorState,
	EditorView,
	Extension,
	ensureSyntaxTree
} = require( 'ext.CodeMirror.lib' );
const mwModeConfig = require( './codemirror.mediawiki.config.js' );
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
 * Find the link at a document position, if any.
 *
 * Kept apart from the mousedown handler so that integrations without an EditorView can reuse
 * it. The VisualEditor ones need that: CodeMirror gets none of their mouse events, so they
 * resolve the position from VisualEditor's own surface instead.
 *
 * @param {EditorState} state
 * @param {number} position
 * @return {Object|null} `{ url, from, to }`, where the offsets span the whole clickable token,
 *   or null if there is no link at that position. A protocol and its URL count as one token,
 *   matching how the two are underlined together.
 * @internal
 * @private
 */
function resolveLinkAt( state, position ) {
	const tree = ensureSyntaxTree( state, position ),
		node = tree && tree.resolve( position, 1 );
	if ( !node ) {
		return null;
	}
	const { name, from, to } = node,
		names = name.split( '_' );
	if ( names.includes( mwModeConfig.tags.linkPageName ) ||
		names.includes( mwModeConfig.tags.templateName ) ) {
		let page = state.sliceDoc( from, to ),
			{ prevSibling, nextSibling } = node,
			start = from,
			end = to;
		while ( prevSibling && prevSibling.to === start && (
			prevSibling.name === name ||
			prevSibling.name.includes( mwModeConfig.tags.comment )
		) ) {
			if ( prevSibling.name === name ) {
				page = state.sliceDoc( prevSibling.from, prevSibling.to ) + page;
			}
			start = prevSibling.from;
			prevSibling = prevSibling.prevSibling;
		}
		while ( nextSibling && nextSibling.from === end && (
			nextSibling.name === name ||
			nextSibling.name.includes( mwModeConfig.tags.comment )
		) ) {
			if ( nextSibling.name === name ) {
				page += state.sliceDoc( nextSibling.from, nextSibling.to );
			}
			end = nextSibling.to;
			nextSibling = nextSibling.nextSibling;
		}
		page = page.trim();
		const pageName = mw.config.get( 'wgPageName' );
		if ( page.startsWith( '/' ) ) {
			page = `:${ pageName }${ page }`;
		} else if ( page.startsWith( '../' ) ) {
			const [ { length } ] = /^(?:\.\.\/)*/.exec( page ),
				level = length / 3,
				parts = pageName.split( '/' );
			if ( level >= parts.length ) {
				return null;
			}
			const sub = page.slice( length );
			page = `:${ parts.slice( 0, -level ).join( '/' ) }${ sub && '/' }${ sub }`;
		}
		let ns = names.includes( mwModeConfig.tags.templateName ) ? 10 : 0;
		if ( names.includes( 'mw-tag-gallery' ) && !name.includes( 'link-ground' ) ) {
			ns = 6;
		}
		const title = mw.Title.newFromText( page, ns );
		if ( title ) {
			return { url: title.getUrl(), from: start, to: end };
		}
	} else if ( names.includes( mwModeConfig.tags.extLinkProtocol ) ||
		names.includes( mwModeConfig.tags.freeExtLinkProtocol ) ) {
		const end = node.nextSibling.to;
		return { url: state.sliceDoc( from, end ), from, to: end };
	} else if ( names.includes( mwModeConfig.tags.extLink ) ||
		names.includes( mwModeConfig.tags.freeExtLink ) ) {
		const start = node.prevSibling.from;
		return { url: state.sliceDoc( start, to ), from: start, to };
	} else if ( names.includes( mwModeConfig.tags.pageName ) &&
		names.includes( 'mw-ext-templatestyles' ) ) {
		const title = mw.Title.newFromText(
			state.sliceDoc( from, to ).trim(),
			// templateStylesDefaultNamespace is always set in this case
			mw.config.get( 'extCodeMirrorConfig' ).templateStylesDefaultNamespace
		);
		if ( title ) {
			return { url: title.getUrl(), from, to };
		}
	} else if ( name.includes( mwModeConfig.tags.pageName ) &&
		names.includes( mwModeConfig.tags.parserFunction ) ) {
		const ns = Number( /mw-function-(\d+)/.exec( name )[ 1 ] ),
			title = mw.Title.newFromText( state.sliceDoc( from, to ).trim(), ns );
		if ( title ) {
			return { url: title.getUrl(), from, to };
		}
	}
	return null;
}

/**
 * CodeMirror extension that opens links by modifier-clicking for the MediaWiki mode.
 * This automatically applied when using {@link CodeMirrorMediaWiki}.
 *
 * @type {Extension}
 * @internal
 * @private
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

/**
 * What an integration needs to open links when it receives the mouse events itself, rather than
 * letting {@link openLinksExtension} handle them. Reached through
 * {@link CodeMirrorMediaWiki#openLinks}, so that a mode which cannot resolve links simply does
 * not offer it.
 *
 * @type {Object}
 * @property {Function} resolveLinkAt
 * @property {Function} hasModifier
 * @property {string} modKey
 * @internal
 * @private
 */
const openLinksSupport = {
	resolveLinkAt,
	hasModifier: hasOpenLinksModifier,
	modKey
};

module.exports = {
	openLinksExtension,
	openLinksSupport
};
