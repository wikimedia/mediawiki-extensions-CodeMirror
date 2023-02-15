mw.loader.using( 'ext.visualEditor.targetLoader' ).then( function () {
	mw.libs.ve.targetLoader.addPlugin( function () {
		var target = ve.init.mw.DesktopArticleTarget;
		if ( target ) {
			var groups = target.static.toolbarGroups.concat( target.static.actionGroups );
			groups.some( function ( group ) {
				if ( group.name === 'pageMenu' ) {
					var index = group.include.indexOf( 'changeDirectionality' );
					group.include.splice( index, 0, 'codeMirror' );
					return true;
				}
				return false;
			} );
		}
	} );
} );
