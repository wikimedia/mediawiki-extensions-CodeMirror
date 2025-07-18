/**
 * Main entry point for CodeMirror initialization on action=edit.
 */

const useCodeMirror = mw.user.options.get( 'usecodemirror' ) > 0;
const resourceLoaderModules = mw.config.get( 'cmRLModules' );
const useWikiEditor = resourceLoaderModules.includes( 'ext.CodeMirror.v6.WikiEditor' );
const mode = mw.config.get( 'cmMode' );

/**
 * Get a LanguageSupport instance for the current mode.
 *
 * @param {Function} require
 * @return {LanguageSupport}
 */
function getLanguageSupport( require ) {
	// eslint-disable-next-line security/detect-non-literal-require
	const langSupport = require( `ext.CodeMirror.v6.mode.${ mode }` );

	if ( mode !== 'mediawiki' ) {
		return langSupport[ mode ]();
	}

	const urlParams = new URLSearchParams( window.location.search );
	return langSupport( {
		bidiIsolation: urlParams.get( 'cm6bidi' )
	} );
}

/**
 * Initialize CodeMirror.
 */
async function init() {
	const require = await mw.loader.using( resourceLoaderModules );
	// eslint-disable-next-line security/detect-non-literal-require
	const CodeMirror = require( `ext.CodeMirror.v6${ useWikiEditor ? '.WikiEditor' : '' }` );
	const langSupport = getLanguageSupport( require );

	if ( useWikiEditor ) {
		mw.hook( 'wikiEditor.toolbarReady' ).add( ( $textarea ) => {
			const cmWE = new CodeMirror( $textarea, langSupport );
			cmWE.initialize();
			initChildren( cmWE );
		} );
	} else {
		const textarea = document.querySelector( mw.config.get( 'cmTextarea' ) );
		const cm = new CodeMirror( textarea, langSupport );
		cm.initialize();
		initChildren( cm );
	}
}

/**
 * Initialize child CodeMirror instances, if any.
 *
 * @param {CodeMirror} primaryInstance
 */
function initChildren( primaryInstance ) {
	const childTextareas = mw.config.get( 'cmChildTextareas', [] );

	childTextareas.forEach( ( textarea ) => {
		const childTextarea = document.querySelector( textarea );
		if ( childTextarea ) {
			// eslint-disable-next-line new-cap
			const cmChild = new primaryInstance.child( textarea, primaryInstance );
			cmChild.initialize();
		}
	} );
}

// Only add the 'Syntax' toolbar button to WikiEditor if CodeMirror is disabled.
if ( useWikiEditor && !useCodeMirror ) {
	// We don't need to use `using()` since 'wikiEditor.toolbarReady'
	// will only fire after ext.wikiEditor is loaded.
	mw.loader.load( 'ext.wikiEditor' );
	// NOTE: This code is duplicated in CodeMirrorWikiEditor#initialize().
	// This minor sacrifice is made to avoid loading all the modules when the user may have
	// no intention of using CodeMirror.
	mw.hook( 'wikiEditor.toolbarReady' ).add( ( $textarea ) => {
		$textarea.wikiEditor( 'addToToolbar', { section: 'main', groups: {
			codemirror: {
				tools: {
					CodeMirror: {
						type: 'element',
						element: () => {
							// OOUI has already been loaded by WikiEditor.
							const button = new OO.ui.ToggleButtonWidget( {
								label: mw.msg( 'codemirror-toggle-label-short' ),
								title: mw.msg( 'codemirror-toggle-label' ),
								icon: 'syntax-highlight',
								value: false,
								framed: false,
								classes: [ 'tool', 'cm-mw-toggle-wikieditor' ]
							} );
							button.on( 'click', init );
							return button.$element;
						}
					}
				}
			}
		} } );
		document.querySelector( '.tool[rel=CodeMirror]' ).id = 'mw-editbutton-codemirror';

		// Hide non-applicable buttons until WikiEditor better supports a read-only mode (T188817).
		if ( mw.config.get( 'cmReadOnly' ) ) {
			// eslint-disable-next-line no-jquery/no-global-selector
			$( '#wpTextbox1' ).data( 'wikiEditor-context' ).$ui.addClass( 'ext-codemirror-readonly' );
		}
		// Similarly hide non-applicable buttons for non-wikitext.
		// CSS classes used here may include but are not limited to:
		// * ext-codemirror-mediawiki
		// * ext-codemirror-javascript
		// * ext-codemirror-css
		// * ext-codemirror-json
		// eslint-disable-next-line no-jquery/no-global-selector
		$( '#wpTextbox1' ).data( 'wikiEditor-context' ).$ui.addClass( `ext-codemirror-${ mode }` );
	} );
} else {
	// Otherwise load all the modules and initialize CodeMirror.
	init();
}
