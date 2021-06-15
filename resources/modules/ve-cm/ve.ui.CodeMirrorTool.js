/**
 * MediaWiki UserInterface CodeMirror tool.
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
ve.ui.CodeMirrorTool.static.group = 'codeMirror';
ve.ui.CodeMirrorTool.static.commandName = 'codeMirror';
ve.ui.CodeMirrorTool.static.deactivateOnSelect = false;

// TODO: consolidate with code in ext.CodeMirror.js, see T272035
ve.ui.CodeMirrorTool.prototype.logUsage = function ( data ) {
	/* eslint-disable camelcase */
	var event = $.extend( {
		session_token: mw.user.sessionId(),
		user_id: mw.user.getId()
	}, data );
	var editCountBucket = mw.config.get( 'wgUserEditCountBucket' );
	if ( editCountBucket !== null ) {
		event.user_edit_count_bucket = editCountBucket;
	}
	/* eslint-enable camelcase */
	mw.track( 'event.CodeMirrorUsage', event );
};

/**
 * @inheritdoc
 */
ve.ui.CodeMirrorTool.prototype.onSelect = function () {
	// Parent method
	ve.ui.CodeMirrorTool.super.prototype.onSelect.apply( this, arguments );

	var useCodeMirror = !!this.toolbar.surface.mirror;
	this.setActive( useCodeMirror );

	new mw.Api().saveOption( 'usecodemirror', useCodeMirror ? 1 : 0 );
	mw.user.options.set( 'usecodemirror', useCodeMirror ? 1 : 0 );

	this.logUsage( {
		editor: 'wikitext-2017',
		enabled: useCodeMirror,
		toggled: true,
		// eslint-disable-next-line camelcase
		edit_start_ts_ms: ( this.toolbar.target.startTimeStamp * 1000 ) || 0
	} );
};

/**
 * @inheritdoc
 */
ve.ui.CodeMirrorTool.prototype.onSurfaceChange = function ( oldSurface, newSurface ) {
	var isDisabled = newSurface.getMode() !== 'source';

	this.setDisabled( isDisabled );
	if ( !isDisabled ) {
		var command = this.getCommand();
		var surface = this.toolbar.getSurface();
		var useCodeMirror = mw.user.options.get( 'usecodemirror' ) > 0;
		command.execute( surface, [ useCodeMirror ] );
		this.setActive( useCodeMirror );

		if ( this.toolbar.target.startTimeStamp ) {
			this.logUsage( {
				editor: 'wikitext-2017',
				enabled: useCodeMirror,
				toggled: false,
				// eslint-disable-next-line camelcase
				edit_start_ts_ms: ( this.toolbar.target.startTimeStamp * 1000 ) || 0
			} );
		}
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
