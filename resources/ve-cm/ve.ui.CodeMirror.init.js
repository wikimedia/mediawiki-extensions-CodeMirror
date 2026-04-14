require( '../ext.CodeMirror.data.js' );

/**
 * @module ext.CodeMirror.visualEditor.init
 * @description
 * Main entry point for CodeMirror initialization in VisualEditor.
 *
 * The init module is loaded by Hooks.php and is not intended for external use.
 * Use {@link module:ext.CodeMirror.visualEditor ext.CodeMirror.visualEditor} instead.
 *
 * @see module:ext.CodeMirror.visualEditor
 * @internal
 */

// Add CodeMirror to allow-listed targets as they are created.
mw.loader.using( 'ext.visualEditor.targetLoader' ).then( () => {
	// Loads on desktop and mobile, and for any supported target.
	// The target must still have 'codeMirror' in its toolbar configuration during VE
	// initialization, unless we add the tool manually (as done for DiscussionTools below).
	mw.libs.ve.targetLoader.addPlugin( 'ext.CodeMirror.visualEditor' );
	mw.libs.ve.targetLoader.loadModules( 'source' );

	mw.hook( 've.newTarget' ).add( ( target ) => {
		if ( target.constructor.static.name === 'article' ) {
			// Should already be loaded for desktop article targets.
			return;
		}
		// T407918: DiscussionTools integration
		if ( target.constructor.static.name === 'discussionTools' ) {
			const promise = mw.loader.using( 'ext.CodeMirror.visualEditor' );
			target.on( 'surfaceReady', async () => {
				if ( target.getSurface().getMode() !== 'source' ) {
					return;
				}
				await promise;
				// Add the button to the DT toolbar.
				const toolGroup = target.getToolbar().getToolGroupByName( 'style' );
				const tool = new ve.ui.CodeMirrorTool( toolGroup );
				toolGroup.addItems( tool );
				// onSurfaceChange will run the now-registered Command.
				tool.onSurfaceChange( null, target.getSurface() );
			} );
		}
	} );
} );
