/*!
 * VisualEditor UserInterface CodeMirrorAction class.
 */

require( './ve.ui.CodeMirrorTool.js' );
require( './ve.ui.CodeMirrorPreferencesPage.js' );
require( './ve.ui.CodeMirrorPreferencesTool.js' );

/**
 * CodeMirror action
 *
 * @class
 * @extends ve.ui.Action
 * @constructor
 * @param {ve.ui.Surface} surface Surface to act on
 */
ve.ui.CodeMirrorAction = function VeUiCodeMirrorAction() {
	// Parent constructor
	ve.ui.CodeMirrorAction.super.apply( this, arguments );
};

/* Inheritance */

OO.inheritClass( ve.ui.CodeMirrorAction, ve.ui.Action );

/* Static Properties */

ve.ui.CodeMirrorAction.static.name = 'codeMirror';

/**
 * @inheritdoc
 */
ve.ui.CodeMirrorAction.static.methods = [ 'toggle' ];

/* Methods */

/**
 * @method
 * @param {boolean} [enable] State to force toggle to, inverts current state if undefined
 * @return {Promise} Action was executed
 */
ve.ui.CodeMirrorAction.prototype.toggle = async function ( enable ) {
	if ( !this.surface.mirror && ( enable || enable === undefined ) ) {
		const useCustomHighlight = ve.ui.CodeMirrorTool.static.useCustomHighlight();
		const modules = [ 'ext.CodeMirror.mode.mediawiki', 'jquery.client' ];
		if ( useCustomHighlight ) {
			// Load the ::highlight() rules only for the controller that draws them. The browser
			// matches them against the whole document on each style recalculation, which costs
			// seconds on a long article, so VisualEditor must not carry them by default.
			modules.push( 'ext.CodeMirror.visualEditor.highlight' );
		}
		await mw.loader.using( modules );
		if ( this.surface.mirror ) {
			mw.log( '[CodeMirror] VE mirror already initialized by another action.' );
			return;
		}
		const { mediawiki, matchTag } = require( 'ext.CodeMirror.mode.mediawiki' );
		const langSupport = mediawiki( {
			bidiIsolation: false,
			codeFolding: false,
			foldAllRefs: false,
			autocomplete: false,
			openLinks: false
		} );
		const Controller = useCustomHighlight ?
			require( '../codemirror.visualEditorHighlight.js' ) :
			require( '../codemirror.visualEditor.js' );
		// Only the custom-highlight controller uses matchTag; the other ignores the extra arg.
		this.surface.mirror = new Controller( this.surface, langSupport, matchTag );
		this.surface.mirror.initialize();
		this.surface.mirror.setCodeMirrorPreference( true );
	} else if ( this.surface.mirror ) {
		this.surface.mirror.toggle( enable );
		this.surface.mirror.setCodeMirrorPreference( this.surface.mirror.isActive );
	}
	if ( this.surface.mirror ) {
		// Tools keyed on CodeMirror's state need telling: it loads asynchronously, and
		// toggling it afterwards changes nothing else the toolbar watches.
		this.surface.getModel().emitContextChange();
	}
};

/* Registration */

ve.ui.actionFactory.register( ve.ui.CodeMirrorAction );
