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
 * @return {Promise} Action was executed
 */
ve.ui.CodeMirrorAction.prototype.toggle = async function ( enable ) {
	if ( !this.surface.mirror && ( enable || enable === undefined ) ) {
		await mw.loader.using( [ 'ext.CodeMirror.v6.mode.mediawiki' ] );
		const CodeMirrorVisualEditor = require( '../codemirror.visualEditor.js' );
		const { mediawiki } = require( 'ext.CodeMirror.v6.mode.mediawiki' );
		this.surface.mirror = new CodeMirrorVisualEditor(
			this.surface,
			mediawiki( {
				bidiIsolation: false,
				codeFolding: false,
				autocomplete: false,
				openLinks: false
			} )
		);
		this.surface.mirror.initialize();
	} else if ( this.surface.mirror ) {
		this.surface.mirror.toggle( enable );
	}
};

/* Registration */

ve.ui.actionFactory.register( ve.ui.CodeMirrorAction );
