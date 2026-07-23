/**
 * @module ext.CodeMirror.init
 * @description
 * Main entry point for CodeMirror initialization on action=edit, Special:Upload, etc.
 *
 * The init module is loaded by Hooks.php and is not intended for external use.
 * Use {@link module:ext.CodeMirror ext.CodeMirror} instead.
 *
 * @see module:ext.CodeMirror
 * @internal
 */

const mode = mw.config.get( 'cmMode' );
const optionName = mode === 'mediawiki' ? 'usecodemirror' : 'usecodemirror-code';
const useCodeMirror = mw.user.options.get( optionName ) > 0;
const resourceLoaderModules = mw.config.get( 'cmRLModules' );
const useWikiEditor = resourceLoaderModules.includes( 'ext.CodeMirror.WikiEditor' );
const cmTextarea = mw.config.get( 'cmTextarea', null );
const action = mw.config.get( 'wgAction' );

/**
 * Get a LanguageSupport instance for the current mode.
 *
 * @return {LanguageSupport}
 * @private
 */
function getLanguageSupport() {
	if ( mode !== 'mediawiki' ) {
		return require( 'ext.CodeMirror.modes' )[ mode ]();
	}

	const langSupport = require( 'ext.CodeMirror.mode.mediawiki' ).mediawiki;
	const urlParams = new URLSearchParams( window.location.search );
	return langSupport( {
		bidiIsolation: urlParams.get( 'cm6bidi' ),
		languageVariants: mw.config.get( 'cmLanguageVariants', [] )
	} );
}

/**
 * Initialize CodeMirror.
 *
 * @private
 */
async function init() {
	await mw.loader.using( resourceLoaderModules );
	// eslint-disable-next-line security/detect-non-literal-require
	const CodeMirror = require( `ext.CodeMirror${ useWikiEditor ? '.WikiEditor' : '' }` );
	const langSupport = getLanguageSupport();
	let cm;

	const doInit = ( textarea ) => {
		cm = new CodeMirror( textarea, langSupport );
		cm.initialize();
		initChildren( cm );
		cm.setCodeMirrorPreference( true );
	};

	if ( useWikiEditor ) {
		mw.hook( 'wikiEditor.toolbarReady' ).add( ( $textarea ) => doInit( $textarea ) );
	} else {
		const textarea = cmTextarea ?
			document.querySelector( cmTextarea ) :
			// This textarea is never added to the DOM.
			document.createElement( 'textarea' );
		doInit( textarea );
	}

	if ( mw.config.get( 'cmDebug' ) ) {
		window.cm = cm;
	}
}

/**
 * Initialize child CodeMirror instances, if any.
 *
 * @param {CodeMirror} primaryInstance
 * @private
 */
function initChildren( primaryInstance ) {
	const childTextareas = mw.config.get( 'cmChildTextareas', [] );

	childTextareas.forEach( ( textarea ) => {
		// The selector may match zero or more textareas.
		// We want to initialize a child instance for each of them.
		for ( const childTextarea of document.querySelectorAll( textarea ) ) {
			// eslint-disable-next-line new-cap
			const cmChild = new primaryInstance.child( childTextarea, primaryInstance );
			cmChild.initialize();
		}
	} );
}

/**
 * Add a 'Syntax' toggle button to the WikiEditor toolbar.
 *
 * NOTE: This code is duplicated in CodeMirrorWikiEditor#initialize().
 * This minor sacrifice is made to avoid loading all the modules when the user may have
 * no intention of using CodeMirror.
 *
 * @private
 */
function addCodeMirrorButton() {
	// We don't need to use `using()` since 'wikiEditor.toolbarReady'
	// will only fire after ext.wikiEditor is loaded.
	mw.loader.load( 'ext.wikiEditor' );

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
								icon: 'highlight',
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
			$textarea.data( 'wikiEditor-context' ).$ui.addClass( 'ext-codemirror-readonly' );
		}
		// Similarly hide non-applicable buttons for non-wikitext.
		// CSS classes used here may include but are not limited to:
		// * ext-codemirror-mediawiki
		// * ext-codemirror-javascript
		// * ext-codemirror-css
		// * ext-codemirror-json
		$textarea.data( 'wikiEditor-context' ).$ui.addClass( `ext-codemirror-${ mode }` );
	} );
}

function addCodeMirrorButtonOrInit() {
	mw.hook( 'wikipage.editform' ).remove( addCodeMirrorButtonOrInit );
	// Value of 0 means there intentionally is no primary textarea
	// (i.e. Special:SecurePoll/translate).
	// Guard against there being no textarea, i.e. "Section editing not supported" error (T424877).
	if ( cmTextarea === 0 || document.querySelector( cmTextarea ) ) {
		// Only add the 'Syntax' toolbar button to WikiEditor if CodeMirror is disabled.
		if ( useWikiEditor && !useCodeMirror ) {
			addCodeMirrorButton();
		} else {
			// Otherwise load all the modules and initialize CodeMirror.
			init();
		}
	}
}

if ( action === 'edit' || action === 'submit' ) {
	mw.hook( 'wikipage.editform' ).add( addCodeMirrorButtonOrInit );
} else {
	addCodeMirrorButtonOrInit();
}
