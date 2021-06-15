mw.loader.using( 'ext.visualEditor.targetLoader' ).then( function () {
	mw.libs.ve.targetLoader.addPlugin( function () {
		var target = ve.init.mw.DesktopArticleTarget;

		if ( target ) {
			var index = target.static.actionGroups[ 1 ].include.indexOf( 'changeDirectionality' );
			target.static.actionGroups[ 1 ].include.splice( index, 0, 'codeMirror' );
		}
	} );
} );
