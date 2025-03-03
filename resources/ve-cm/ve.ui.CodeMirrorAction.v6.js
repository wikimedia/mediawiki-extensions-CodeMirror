/*!
 * VisualEditor UserInterface CodeMirrorAction class.
 */

require( './ve.ui.CodeMirrorTool.v6.js' );

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

/* Methods */

/**
 * @method
 * @param {boolean} [enable] State to force toggle to, inverts current state if undefined
 * @return {boolean} Action was executed
 */
ve.ui.CodeMirrorAction.prototype.toggle = function ( enable ) {
	if ( !this.surface.mirror && ( enable || enable === undefined ) ) {
		mw.loader.using( [ 'jquery.client', 'ext.CodeMirror.v6.mode.mediawiki' ] ).then( () => {
			const CodeMirrorVisualEditor = require( '../codemirror.visualEditor.js' );
			const mediawikiLang = require( 'ext.CodeMirror.v6.mode.mediawiki' );
			this.surface.mirror = new CodeMirrorVisualEditor(
				this.surface,
				mediawikiLang( {
					bidiIsolation: false,
					codeFolding: false,
					autocomplete: false,
					openLinks: false
				} )
			);
			this.surface.mirror.initialize();
		} );
	} else if ( this.surface.mirror ) {
		this.surface.mirror.toggle( enable );
	}

	return true;
};

/* Registration */

ve.ui.actionFactory.register( ve.ui.CodeMirrorAction );
