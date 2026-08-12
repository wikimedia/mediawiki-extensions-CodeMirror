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

/**
 * Stylesheet of ext.CodeMirror.visualEditor.highlight, when it could be identified.
 *
 * @type {CSSStyleSheet|null}
 * @private
 */
let highlightStyleSheet = null;

/**
 * Load the ::highlight() rules, and keep the stylesheet they arrive in.
 *
 * The module is loaded on its own. ResourceLoader gives one request a single <style>
 * element, so a batched request would put these rules together with other modules'
 * rules, and #setHighlightStylesEnabled could not then park them alone.
 *
 * A potential enhancement would be to split this module up further so that it
 * contains only the ::highlight styles, so we can be confident there won't be
 * any side-effects from disabling it.
 *
 * @return {Promise}
 * @private
 */
async function loadHighlightStyles() {
	// Only this load can tell which stylesheet is ours. If the module has already been
	// requested, by a gadget or a user script, ResourceLoader adds nothing here and the
	// sheet cannot be told apart. Leave the rules enabled: that is slower, but it is
	// never wrong, and the other script decides how long they stay.
	const ourLoad = mw.loader.getState( 'ext.CodeMirror.visualEditor.highlight' ) === 'registered';
	const before = new Set( document.styleSheets );
	await mw.loader.using( 'ext.CodeMirror.visualEditor.highlight' );
	if ( ourLoad && !highlightStyleSheet ) {
		const added = Array.prototype.filter.call(
			document.styleSheets, ( sheet ) => !before.has( sheet )
		);
		// One <style> element holds one request, so a lone addition is this module. It
		// also holds anything else queued in the same tick, which parks with it.
		if ( added.length === 1 ) {
			highlightStyleSheet = added[ 0 ];
		}
	}
	ve.ui.CodeMirrorAction.static.setHighlightStylesEnabled( true );
}

/**
 * Enable or park the ::highlight() styles.
 *
 * Browsers match these rules against the whole document on each style
 * recalculation. In Chrome this costs seconds on a long article. Only the highlighter
 * draws them, so park them while it does not draw.
 *
 * @param {boolean} enabled
 */
ve.ui.CodeMirrorAction.static.setHighlightStylesEnabled = function ( enabled ) {
	if ( highlightStyleSheet ) {
		highlightStyleSheet.disabled = !enabled;
	}
};

/* Methods */

/**
 * @method
 * @param {boolean} [enable] State to force toggle to, inverts current state if undefined
 * @return {Promise} Action was executed
 */
ve.ui.CodeMirrorAction.prototype.toggle = async function ( enable ) {
	if ( !this.surface.mirror && ( enable || enable === undefined ) ) {
		const useCustomHighlight = ve.ui.CodeMirrorTool.static.useCustomHighlight();
		await mw.loader.using( [ 'ext.CodeMirror.mode.mediawiki', 'jquery.client' ] );
		if ( useCustomHighlight ) {
			// Only the controller that draws them needs the ::highlight() rules, so
			// VisualEditor must not carry them by default. Loaded after the modules
			// above, not with them; see #loadHighlightStyles.
			await loadHighlightStyles();
		}
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
			// CodeMirror's own handler is a domEventHandlers entry, and it receives no mouse
			// events in either integration. The controllers drive link opening from
			// VisualEditor's events instead, reusing only resolveLinkAt.
			openLinks: false,
			closeTags: false,
			lint: false
		} );
		const Controller = useCustomHighlight ?
			require( './codemirror.visualEditorHighlight.js' ) :
			require( './codemirror.visualEditor.js' );
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
		// For debugging purposes.
		ve.cm = this.surface.mirror;
	}
};

/* Registration */

ve.ui.actionFactory.register( ve.ui.CodeMirrorAction );
