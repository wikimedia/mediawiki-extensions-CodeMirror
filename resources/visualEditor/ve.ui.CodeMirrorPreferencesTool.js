/*!
 * VisualEditor UserInterface CodeMirrorPreferencesTool class.
 */

/**
 * Page menu shortcut to {@link ve.ui.CodeMirrorPreferencesPage}, beside the CodeMirror toggle.
 * Like the other items in that menu, it opens the options dialog on a particular page.
 *
 * @class
 * @extends ve.ui.WindowTool
 * @constructor
 * @param {OO.ui.Toolbar} toolbar
 * @param {Object} [config] Configuration options
 */
ve.ui.CodeMirrorPreferencesTool = function VeUiCodeMirrorPreferencesTool() {
	// Parent constructor
	ve.ui.CodeMirrorPreferencesTool.super.apply( this, arguments );

	// Events
	this.toolbar.connect( this, { surfaceChange: 'onSurfaceChange' } );
};

/* Inheritance */

OO.inheritClass( ve.ui.CodeMirrorPreferencesTool, ve.ui.WindowTool );

/* Static properties */

ve.ui.CodeMirrorPreferencesTool.static.name = 'codeMirrorPreferences';
ve.ui.CodeMirrorPreferencesTool.static.group = 'utility';
ve.ui.CodeMirrorPreferencesTool.static.icon = 'settings';
ve.ui.CodeMirrorPreferencesTool.static.title =
	OO.ui.deferMsg( 'codemirror-prefs-title' );
ve.ui.CodeMirrorPreferencesTool.static.commandName = 'codeMirrorPreferences';
ve.ui.CodeMirrorPreferencesTool.static.autoAddToCatchall = false;

/* Methods */

/**
 * @inheritdoc
 */
ve.ui.CodeMirrorPreferencesTool.prototype.onUpdateState = function () {
	// Parent method
	ve.ui.CodeMirrorPreferencesTool.super.prototype.onUpdateState.apply( this, arguments );

	this.updateDisabled();
};

/**
 * The toolbar keeps its tools across a mode switch, so visibility has to be updated here rather
 * than left to which tools were built.
 *
 * @param {ve.ui.Surface} oldSurface
 * @param {ve.ui.Surface} newSurface
 */
ve.ui.CodeMirrorPreferencesTool.prototype.onSurfaceChange = function ( oldSurface, newSurface ) {
	// Hidden outside source mode, where highlighting cannot apply at all. The toggle beside this
	// stays visible but disabled there, which is enough to advertise the mode switch.
	this.toggle( !!newSurface && newSurface.getMode() === 'source' );
	this.updateDisabled();
};

/**
 * Disable the tool while there is nothing to configure. Within source mode it stays visible while
 * disabled, since turning highlighting on is what makes it usable.
 *
 * @private
 */
ve.ui.CodeMirrorPreferencesTool.prototype.updateDisabled = function () {
	const surface = this.toolbar.getSurface();
	this.setDisabled( !surface || !surface.mirror || !surface.mirror.isActive );
};

/* Registration */

ve.ui.toolFactory.register( ve.ui.CodeMirrorPreferencesTool );

ve.ui.commandRegistry.register(
	new ve.ui.Command(
		'codeMirrorPreferences', 'window', 'open',
		{ args: [ 'meta', { page: 'codeMirrorPreferences' } ] }
	)
);
