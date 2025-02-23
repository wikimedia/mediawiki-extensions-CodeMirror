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
	const isDisabled = newSurface.getMode() !== 'source';

	this.setDisabled( isDisabled );
	if ( !isDisabled ) {
		const command = this.getCommand();
		const surface = this.toolbar.getSurface();
		const useCodeMirror = mw.user.options.get( 'usecodemirror' ) > 0;
		command.execute( surface, [ useCodeMirror ] );
		this.setActive( useCodeMirror );
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
