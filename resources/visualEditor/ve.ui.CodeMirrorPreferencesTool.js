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

	// The tool is enabled when syntax highlighting is enabled
	const surface = this.toolbar.getSurface();
	this.setDisabled( !surface || !surface.mirror || !surface.mirror.isActive );
};

/* Registration */

ve.ui.toolFactory.register( ve.ui.CodeMirrorPreferencesTool );

// Registering in wikitextCommandRegistry means that the tool will be
// automatically hidden in visual mode
ve.ui.wikitextCommandRegistry.register(
	new ve.ui.Command(
		'codeMirrorPreferences', 'window', 'open',
		{ args: [ 'meta', { page: 'codeMirrorPreferences' } ] }
	)
);
