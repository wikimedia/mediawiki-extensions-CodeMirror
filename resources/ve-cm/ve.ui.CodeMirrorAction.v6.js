/*!
 * VisualEditor UserInterface CodeMirrorAction class.
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
	const action = this,
		surface = this.surface,
		surfaceView = surface.getView(),
		doc = surface.getModel().getDocument();

	if ( !surface.mirror && enable !== false ) {
		surface.mirror = true;
		mw.loader.using( [
			'ext.CodeMirror.v6',
			'ext.CodeMirror.v6.lib',
			'ext.CodeMirror.v6.mode.mediawiki',
			'jquery.client'
		] ).then( ( require ) => {
			const CodeMirror = require( 'ext.CodeMirror.v6' );
			const codeMirrorLib = require( 'ext.CodeMirror.v6.lib' );
			const mediawikiLang = require( 'ext.CodeMirror.v6.mode.mediawiki' );

			if ( !surface.mirror ) {
				// Action was toggled to false since promise started
				return;
			}

			// The VE/CM overlay technique only works with monospace fonts
			// (as we use width-changing bold as a highlight) so revert any editfont user preference
			surfaceView.$element.removeClass( 'mw-editfont-sans-serif mw-editfont-serif' )
				.addClass( 'mw-editfont-monospace' );

			if ( mw.user.options.get( 'usecodemirror-colorblind' ) ) {
				surfaceView.$element.addClass( 'cm-mw-colorblind-colors' );
			}

			surface.mirror = new CodeMirror( surface );
			const lineHeightExtension = codeMirrorLib.EditorView.theme( {
				'.cm-content': {
					lineHeight: 1.5
				}
			} );

			const profile = $.client.profile();
			const supportsTransparentText = 'WebkitTextFillColor' in document.body.style &&
				// Disable on Firefox+OSX (T175223)
				!( profile.layout === 'gecko' && profile.platform === 'mac' );

			surfaceView.$documentNode.addClass(
				supportsTransparentText ?
					've-ce-documentNode-codeEditor-webkit-hide' :
					've-ce-documentNode-codeEditor-hide'
			);

			// TODO: pass bidiIsolation option to mediawikiLang() when it's more stable.
			surface.mirror.initialize( surface.mirror.defaultExtensions.concat( mediawikiLang( {
				templateFolding: false
			} ), lineHeightExtension ) );
			// Force infinite viewport in CodeMirror to prevent misalignment of
			// the VE surface and the CodeMirror view. See T357482#10076432.
			surface.mirror.view.viewState.printing = true;

			// Disable the Extension that highlights special characters.
			surface.mirror.view.dispatch( {
				effects: surface.mirror.specialCharsCompartment.reconfigure(
					codeMirrorLib.EditorView.editorAttributes.of( [] )
				)
			} );

			// Account for the gutter width in the margin.
			action.updateGutterWidth( doc.getDir() );

			// Set focus on the surface view.
			surfaceView.focus();

			/* Events */

			// As the action is regenerated each time, we need to store bound listeners
			// in the mirror for later disconnection.
			surface.mirror.veTransactionListener = action.onDocumentPrecommit.bind( action );
			surface.mirror.veSelectListener = action.onSelect.bind( action );
			surface.mirror.vePositionListener = action.onPosition.bind( action );

			doc.on( 'precommit', surface.mirror.veTransactionListener );
			surface.getModel().on( 'select', surface.mirror.veSelectListener );
			surfaceView.on( 'position', surface.mirror.vePositionListener );
		} );
	} else if ( surface.mirror && enable !== true ) {
		if ( surface.mirror !== true ) {
			surfaceView.off( 'position', surface.mirror.vePositionListener );
			doc.off( 'precommit', surface.mirror.veTransactionListener );
			surface.getModel().off( 'select', surface.mirror.veSelectListener );

			// Restore edit-font
			// eslint-disable-next-line mediawiki/class-doc
			surfaceView.$element.removeClass( 'mw-editfont-monospace' )
				.addClass( 'mw-editfont-' + mw.user.options.get( 'editfont' ) );

			surfaceView.$documentNode.removeClass(
				've-ce-documentNode-codeEditor-webkit-hide',
				've-ce-documentNode-codeEditor-hide'
			);
			// Reset gutter.
			surfaceView.$documentNode.css( {
				'margin-left': '',
				'margin-right': ''
			} );

			// Set focus on the surface view.
			surface.getView().focus();

			surface.mirror.destroy();
			surface.mirror.view = null;
		}

		surface.mirror = null;
	}

	return true;
};

/**
 * Update margins to account for the CodeMirror gutter.
 *
 * @param {string} dir Document direction
 */
ve.ui.CodeMirrorAction.prototype.updateGutterWidth = function ( dir ) {
	const guttersWidth = this.surface.mirror.view.dom.querySelector( '.cm-gutters' ).offsetWidth;
	this.surface.getView().$documentNode.css( {
		'margin-left': dir === 'rtl' ? 0 : guttersWidth - 6,
		'margin-right': dir === 'rtl' ? guttersWidth - 6 : 0
	} );
	// Also update width of .cm-content due to apparent Chromium bug.
	this.surface.mirror.view.contentDOM.style.width = 'calc(100% - ' + ( guttersWidth + 1 ) + 'px)';
};

/**
 * Mirror document directionality changes to CodeMirror.
 */
ve.ui.CodeMirrorAction.prototype.onPosition = function () {
	const codeMirrorLib = require( 'ext.CodeMirror.v6.lib' );
	const veDir = this.surface.getView().getDocument().getDir();
	const cmView = this.surface.mirror.view;
	const cmDir = cmView.textDirection === codeMirrorLib.Direction.LTR ? 'ltr' : 'rtl';
	if ( veDir !== cmDir ) {
		cmView.dispatch( {
			effects: this.surface.mirror.dirCompartment.reconfigure(
				codeMirrorLib.EditorView.editorAttributes.of( { dir: veDir } )
			)
		} );
		this.updateGutterWidth( veDir );
	}
};

/**
 * Handle select events from the surface model
 *
 * @param {ve.dm.Selection} selection
 */
ve.ui.CodeMirrorAction.prototype.onSelect = function ( selection ) {
	const range = selection.getCoveringRange();

	// Do not re-trigger bracket matching as long as something is selected
	if ( !range || !range.isCollapsed() ) {
		return;
	}

	const offset = this.surface.getModel().getSourceOffsetFromOffset( range.from );

	this.surface.mirror.view.dispatch( {
		selection: {
			anchor: offset,
			head: offset
		}
	} );
};

/**
 * Handle precommit events from the document.
 *
 * The document is still in it's 'old' state before the transaction
 * has been applied at this point.
 *
 * @param {ve.dm.Transaction} tx
 */
ve.ui.CodeMirrorAction.prototype.onDocumentPrecommit = function ( tx ) {
	const replacements = [],
		action = this,
		store = this.surface.getModel().getDocument().getStore();
	let offset = 0;

	tx.operations.forEach( ( op ) => {
		if ( op.type === 'retain' ) {
			offset += op.length;
		} else if ( op.type === 'replace' ) {
			replacements.push( {
				from: action.surface.getModel().getSourceOffsetFromOffset( offset ),
				to: action.surface.getModel().getSourceOffsetFromOffset( offset + op.remove.length ),
				insert: new ve.dm.ElementLinearData( store, op.insert ).getSourceText()
			} );
			offset += op.remove.length;
		}
	} );

	// Apply replacements in reverse to avoid having to shift offsets
	for ( let i = replacements.length - 1; i >= 0; i-- ) {
		this.surface.mirror.view.dispatch( { changes: replacements[ i ] } );
	}

	action.updateGutterWidth( this.surface.getModel().getDocument().getDir() );
};

/* Registration */

ve.ui.actionFactory.register( ve.ui.CodeMirrorAction );
