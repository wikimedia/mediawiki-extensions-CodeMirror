/*!
 * VisualEditor UserInterface CodeMirrorAction class.
 *
 * @copyright 2011-2017 VisualEditor Team and others; see http://ve.mit-license.org
 */

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
	var surface = this.surface,
		surfaceView = surface.getView(),
		doc = surface.getModel().getDocument();

	if ( !surface.mirror && enable !== false ) {
		surface.mirror = CodeMirror( surfaceView.$element[ 0 ], {
			value: surface.getDom(),
			mwConfig: mw.config.get( 'extCodeMirrorConfig' ),
			lineWrapping: true,
			tabSize: 1,
			scrollbarStyle: 'null',
			viewportMargin: 5,
			// select mediawiki as text input mode
			mode: 'text/mediawiki',
			extraKeys: {
				Tab: false
			}
		} );

		surfaceView.$documentNode.addClass(
			'WebkitTextFillColor' in document.body.style ?
			've-ce-documentNode-codeEditor-webkit-hide' :
			've-ce-documentNode-codeEditor-webkit'
		);

		// As the action is regenerated each time, we need to store the bound listener
		// in the mirror for later disconnection.
		surface.mirror.veTransactionListener = this.onDocumentTransact.bind( this, surface );

		doc.on( 'transact', surface.mirror.veTransactionListener );
	} else if ( surface.mirror && enable !== true ) {
		doc.off( 'transact', surface.mirror.veTransactionListener );

		surfaceView.$documentNode.removeClass(
			've-ce-documentNode-codeEditor-webkit-hide ve-ce-documentNode-codeEditor-webkit'
		);

		surface.mirror.getWrapperElement().remove();

		surface.mirror = null;
	}

	return true;
};

ve.ui.CodeMirrorAction.prototype.onDocumentTransact = function ( surface, tx ) {
	var node, textRange, line,
		doc = surface.getModel().getDocument(),
		mirror = surface.mirror,
		modifiedRange = tx.getModifiedRange( doc ),
		nodes = doc.selectNodes( modifiedRange, 'leaves' );

	// TODO: Iterate over operations and perform a replaceRange for each replace operation
	if ( nodes.length === 1 && nodes[ 0 ].node instanceof ve.dm.TextNode ) {
		node = nodes[ 0 ].node.parent;
		textRange = nodes[ 0 ].nodeRange;
		line = node.parent.children.indexOf( node );
		if ( tx.operations.every( function ( op ) {
			return op.type === 'retain' || ( op.type === 'replace' && op.remove.length === 0 );
		} ) ) {
			// Single line insert
			mirror.replaceRange(
				doc.data.getText( true, modifiedRange ),
				{ line: line, ch: modifiedRange.start - textRange.start }
			);
		} else {
			// Single line replace
			mirror.replaceRange(
				doc.data.getText( true, textRange ),
				{ line: line, ch: 0 },
				{ line: line, ch: mirror.getLine( line ).length }
			);
		}
	} else {
		// Fallback - flush whole doc
		mirror.setValue( surface.getDom() );
	}
};

/* Registration */

ve.ui.actionFactory.register( ve.ui.CodeMirrorAction );
