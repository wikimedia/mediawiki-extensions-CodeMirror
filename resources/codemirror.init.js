/**
 * Main entry point for CodeMirror initialization on action=edit.
 */

const isSpecialUpload = mw.config.get( 'wgCanonicalSpecialPageName' ) === 'Upload';
const useCodeMirror = mw.user.options.get( 'usecodemirror' ) > 0;
const useWikiEditor = !isSpecialUpload && mw.user.options.get( 'usebetatoolbar' ) > 0;
const resourceLoaderModules = mw.config.get( 'cmRLModules' );

/**
 * Get a LanguageSupport instance for the current mode.
 *
 * @param {Function} require
 * @return {LanguageSupport}
 */
function getLanguageSupport( require ) {
	const mediawikiLang = require( 'ext.CodeMirror.v6.mode.mediawiki' );
	const urlParams = new URLSearchParams( window.location.search );
	return mediawikiLang( {
		bidiIsolation: urlParams.get( 'cm6bidi' )
	} );
}

/**
 * Initialize CodeMirror.
 *
 * @param {boolean} [fromToggleButton=false] Whether the initialization is triggered by the toolbar
 *   button added by the init script.
 */
function init( fromToggleButton = false ) {
	mw.loader.using( resourceLoaderModules ).then( ( require ) => {
		// eslint-disable-next-line security/detect-non-literal-require
		const CodeMirror = require( `ext.CodeMirror.v6${ useWikiEditor ? '.WikiEditor' : '' }` );
		const langSupport = getLanguageSupport( require );

		if ( useWikiEditor ) {
			mw.hook( 'wikiEditor.toolbarReady' ).add( ( $textarea ) => {
				const cmWE = new CodeMirror( $textarea, langSupport );
				if ( fromToggleButton ) {
					cmWE.setCodeMirrorPreference( true );
				}
				cmWE.addCodeMirrorToWikiEditor();
			} );
		} else {
			const id = isSpecialUpload ? 'wpUploadDescription' : 'wpTextbox1';
			const textarea = document.getElementById( id );
			const cm = new CodeMirror( textarea, langSupport );
			cm.initialize();
		}
	} );
}

// Only add the 'Syntax' toolbar button to WikiEditor if CodeMirror is disabled.
if ( useWikiEditor && !useCodeMirror ) {
	// We don't need to use `using()` since 'wikiEditor.toolbarReady'
	// will only fire after ext.wikiEditor is loaded.
	mw.loader.load( 'ext.wikiEditor' );
	// NOTE: This code is duplicated in CodeMirrorWikiEditor#addCodeMirrorToWikiEditor().
	// This minor sacrifice is made to avoid loading all the modules when the user may have
	// no intention of using CodeMirror.
	mw.hook( 'wikiEditor.toolbarReady' ).add( ( $textarea ) => {
		$textarea.wikiEditor(
			'addToToolbar',
			{
				section: 'main',
				groups: {
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
									button.on( 'click', () => init( true ) );
									return button.$element;
								}
							}
						}
					}
				}
			}
		);
		document.querySelector( '.tool[rel=CodeMirror]' ).id = 'mw-editbutton-codemirror';

		// Hide non-applicable buttons until WikiEditor better supports a read-only mode (T188817).
		if ( mw.config.get( 'cmReadOnly' ) ) {
			// eslint-disable-next-line no-jquery/no-global-selector
			$( '#wpTextbox1' ).data( 'wikiEditor-context' ).$ui.addClass( 'ext-codemirror-readonly' );
		}
	} );
} else {
	// Otherwise load all the modules and initialize CodeMirror.
	init();
}
