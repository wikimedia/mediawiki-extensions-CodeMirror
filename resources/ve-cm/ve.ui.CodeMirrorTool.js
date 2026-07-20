/**
 * VisualEditor UserInterface CodeMirror tool.
 *
 * @class
 * @abstract
 * @extends ve.ui.Tool
 * @constructor
 * @param {OO.ui.ToolGroup} toolGroup
 * @param {Object} [config] Configuration options
 */
ve.ui.CodeMirrorTool = function VeUiCodeMirrorTool() {
	// Parent constructor
	ve.ui.CodeMirrorTool.super.apply( this, arguments );

	// Events
	this.toolbar.connect( this, { surfaceChange: 'onSurfaceChange' } );
};

/* Inheritance */

OO.inheritClass( ve.ui.CodeMirrorTool, ve.ui.Tool );

/* Static properties */

ve.ui.CodeMirrorTool.static.name = 'codeMirror';
ve.ui.CodeMirrorTool.static.autoAddToCatchall = false;
ve.ui.CodeMirrorTool.static.title = OO.ui.deferMsg( 'codemirror-toggle-label' );
ve.ui.CodeMirrorTool.static.icon = 'highlight';
ve.ui.CodeMirrorTool.static.group = 'utility';
ve.ui.CodeMirrorTool.static.commandName = 'codeMirror';
ve.ui.CodeMirrorTool.static.deactivateOnSelect = false;

/**
 * The maximum document size that CodeMirror will handle.
 * VisualEditor uses an infinite viewport which causes massive performance
 * problems in CodeMirror on very large pages, and can even crash the browser.
 * Until the integration is reworked, or VE uses a finite viewport, we put
 * a hard limit on the document size that CodeMirror will attempt to load.
 *
 * See https://phabricator.wikimedia.org/T184857
 *
 * @type {number}
 */
ve.ui.CodeMirrorTool.static.maxDocSize = 250000;

/**
 * Whether the CSS Custom Highlight API mode is in use. That controller highlights only the
 * viewport, so it is exempt from the {@link ve.ui.CodeMirrorTool.maxDocSize} limit.
 *
 * @return {boolean}
 */
ve.ui.CodeMirrorTool.static.useCustomHighlight = function () {
	const config = mw.config.get( 'extCodeMirrorConfig' ) || {};
	return new URL( location.href ).searchParams.get( 'cmhighlight' ) === '1' ||
		!!config.visualEditorCustomHighlight;
};

/**
 * @inheritdoc
 */
ve.ui.CodeMirrorTool.prototype.onSelect = function () {
	// Parent method
	ve.ui.CodeMirrorTool.super.prototype.onSelect.apply( this, arguments );

	// This is the value of what CM will be toggled to.
	// When CM has not been loaded yet (the mirror property is undefined), this should return true.
	const useCodeMirror = !this.toolbar.surface.mirror || this.toolbar.surface.mirror.isActive;

	this.setActive( useCodeMirror );
};

/**
 * @inheritdoc
 */
ve.ui.CodeMirrorTool.prototype.onSurfaceChange = function ( oldSurface, newSurface ) {
	// Disable CM on very large documents (T184857), unless the viewport-bounded custom
	// highlight mode is in use, which does not have the whole-document cost.
	if ( newSurface.getMode() === 'source' &&
		!this.constructor.static.useCustomHighlight() &&
		newSurface.getModel().getDocument().getLength() > this.constructor.static.maxDocSize
	) {
		const messageElem = document.createElement( 'p' );
		messageElem.textContent = mw.msg( 'codemirror-ve-limit-exceeded' );
		const helpLink = document.createElement( 'a' );
		helpLink.href = 'https://www.mediawiki.org/wiki/Special:MyLanguage/Help:Extension:CodeMirror#2017_editor';
		helpLink.target = '_blank';
		helpLink.textContent = mw.msg( 'codemirror-ve-limit-exceeded-info' );
		mw.notify( [ messageElem, helpLink ] );
		this.setDisabled( true );
		return;
	}

	const isDisabled = newSurface.getMode() !== 'source';
	this.setDisabled( isDisabled );
	if ( !isDisabled ) {
		const command = this.getCommand();
		const useCodeMirror = mw.user.options.get( 'usecodemirror' ) > 0;
		command.execute( newSurface, [ useCodeMirror ] );
		this.setActive( useCodeMirror );
		newSurface.once( 'destroy', () => {
			if ( newSurface.mirror ) {
				newSurface.mirror.destroy();
			}
		} );
	}
};

ve.ui.CodeMirrorTool.prototype.onUpdateState = function () {};

/* Registration */

ve.ui.toolFactory.register( ve.ui.CodeMirrorTool );

/* Command */

ve.ui.commandRegistry.register(
	new ve.ui.Command(
		'codeMirror', 'codeMirror', 'toggle'
	)
);
