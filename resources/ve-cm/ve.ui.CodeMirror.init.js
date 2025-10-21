require( '../ext.CodeMirror.data.js' );

/**
 * @module ext.CodeMirror.visualEditor.init
 * @description
 * Main entry point for CodeMirror initialization in VisualEditor.
 *
 * The init module is loaded by Hooks.php and is not intended for external use.
 * Use {@link module:ext.CodeMirror.v6.visualEditor ext.CodeMirror.v6.visualEditor} instead.
 *
 * @see module:ext.CodeMirror.v6.visualEditor
 * @todo Change the PluginModules in extension.json and drop this when fully migrated to v6.
 * @internal
 */

const urlParams = new URLSearchParams( window.location.search );
const shouldUseV6 = mw.config.get( 'extCodeMirrorConfig' ).useV6 ||
	urlParams.get( 'cm6enable' ) ||
	mw.user.options.get( 'codemirror-beta-feature-enable' ) === '1';

if ( shouldUseV6 ) {
	// Add CodeMirror to allow-listed targets as they are created.
	mw.loader.using( 'ext.visualEditor.targetLoader' ).then( () => {
		// Loads on desktop and mobile, and for any supported target.
		// The target must still have 'codeMirror' in its toolbar configuration during VE
		// initialization, unless we add the tool manually (as done for DiscussionTools below).
		mw.libs.ve.targetLoader.addPlugin( 'ext.CodeMirror.v6.visualEditor' );
		mw.libs.ve.targetLoader.loadModules( 'source' );

		mw.hook( 've.newTarget' ).add( ( target ) => {
			if ( target.constructor.static.name === 'article' ) {
				// Should already be loaded for desktop article targets.
				return;
			}
			// T407918: DiscussionTools integration
			if ( target.constructor.static.name === 'discussionTools' ) {
				const promise = mw.loader.using( 'ext.CodeMirror.v6.visualEditor' );
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
} else {
	// Hack to ensure ext.CodeMirror.visualEditor is loaded before VE initializes (T374072).
	// ve.loadModules is only fired on desktop articles, which for CM5 is what we want.
	mw.hook( 've.loadModules' ).add( ( addPlugin ) => {
		addPlugin( () => mw.loader.using( 'ext.CodeMirror.visualEditor' ) );
	} );
}
