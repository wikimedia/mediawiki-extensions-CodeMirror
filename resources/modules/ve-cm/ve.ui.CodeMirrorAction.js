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
 * @return {boolean}
 */
ve.ui.CodeMirrorAction.static.isLineNumbering = function () {
	// T285660: Backspace related bug on Android browsers as of 2021
	if ( /Android\b/.test( navigator.userAgent ) ) {
		return false;
	}

	const namespaces = mw.config.get( 'wgCodeMirrorLineNumberingNamespaces' );
	// Set to [] to disable everywhere, or null to enable everywhere
	return !namespaces ||
		namespaces.indexOf( mw.config.get( 'wgNamespaceNumber' ) ) !== -1;
};

/**
 * @method
 * @param {boolean} [enable] State to force toggle to, inverts current state if undefined
 * @return {boolean} Action was executed
 */
ve.ui.CodeMirrorAction.prototype.toggle = function ( enable ) {
	const surface = this.surface,
		surfaceView = surface.getView(),
		doc = surface.getModel().getDocument();

	if ( !surface.mirror && enable !== false ) {
		surface.mirror = true;
		mw.loader.using( [
			'ext.CodeMirror.lib',
			'ext.CodeMirror.mode.mediawiki',
			'jquery.client'
		] ).then( () => {
			const config = mw.config.get( 'extCodeMirrorConfig' );

			if ( !surface.mirror ) {
				// Action was toggled to false since promise started
				return;
			}
			mw.loader.using( config.pluginModules, () => {
				if ( !surface.mirror ) {
					// Action was toggled to false since promise started
					return;
				}
				const tabSizeValue = surfaceView.documentView.documentNode.$element.css( 'tab-size' );
				const cmOptions = {
					value: surface.getDom(),
					mwConfig: config,
					readOnly: 'nocursor',
					lineWrapping: true,
					scrollbarStyle: 'null',
					specialChars: /^$/,
					viewportMargin: 5,
					tabSize: tabSizeValue ? +tabSizeValue : 8,
					// select mediawiki as text input mode
					mode: 'text/mediawiki',
					extraKeys: {
						Tab: false,
						'Shift-Tab': false
					}
				};

				cmOptions.matchBrackets = {
					highlightNonMatching: false,
					maxHighlightLineLength: 10000
				};

				if ( ve.ui.CodeMirrorAction.static.isLineNumbering() ) {
					Object.assign( cmOptions, {
						// Set up a special "padding" gutter to create space between the line numbers
						// and page content.  The first column name is a magic constant which causes
						// the built-in line number gutter to appear in the desired, leftmost position.
						gutters: [
							'CodeMirror-linenumbers',
							'CodeMirror-linenumber-padding'
						],
						lineNumbers: true
					} );
				}

				surface.mirror = CodeMirror( surfaceView.$element[ 0 ], cmOptions );

				// The VE/CM overlay technique only works with monospace fonts (as we use width-changing bold as a highlight)
				// so revert any editfont user preference
				surfaceView.$element.removeClass( 'mw-editfont-sans-serif mw-editfont-serif' ).addClass( 'mw-editfont-monospace' );

				if ( mw.user.options.get( 'usecodemirror-colorblind' ) ) {
					surfaceView.$element.addClass( 'cm-mw-colorblind-colors' );
				}

				const profile = $.client.profile();
				const supportsTransparentText = 'WebkitTextFillColor' in document.body.style &&
					// Disable on Firefox+OSX (T175223)
					!( profile.layout === 'gecko' && profile.platform === 'mac' );

				surfaceView.$documentNode.addClass(
					supportsTransparentText ?
						've-ce-documentNode-codeEditor-webkit-hide' :
						've-ce-documentNode-codeEditor-hide'
				);

				if ( cmOptions.lineNumbers ) {
					// Transfer gutter width to VE overlay.
					const updateGutter = ( cmDisplay ) => {
						surfaceView.$documentNode.css( 'margin-left', cmDisplay.gutters.offsetWidth );
					};
					CodeMirror.on( surface.mirror.display, 'updateGutter', updateGutter );
					updateGutter( surface.mirror.display );
				}

				/* Events */

				// As the action is regenerated each time, we need to store bound listeners
				// in the mirror for later disconnection.
				surface.mirror.veTransactionListener = this.onDocumentPrecommit.bind( this );
				surface.mirror.veLangChangeListener = this.onLangChange.bind( this );
				surface.mirror.veSelectListener = this.onSelect.bind( this );

				doc.on( 'precommit', surface.mirror.veTransactionListener );
				surfaceView.getDocument().on( 'langChange', surface.mirror.veLangChangeListener );
				surface.getModel().on( 'select', surface.mirror.veSelectListener );

				this.onLangChange();

				ve.init.target.once( 'surfaceReady', () => {
					if ( surface.mirror ) {
						surface.mirror.refresh();
					}
				} );
			} );
		} );
	} else if ( surface.mirror && enable !== true ) {
		if ( surface.mirror !== true ) {
			doc.off( 'precommit', surface.mirror.veTransactionListener );
			surfaceView.getDocument().off( 'langChange', surface.mirror.veLangChangeListener );
			surface.getModel().off( 'select', surface.mirror.veSelectListener );

			// Restore edit-font
			// eslint-disable-next-line mediawiki/class-doc
			surfaceView.$element.removeClass( 'mw-editfont-monospace' ).addClass( 'mw-editfont-' + mw.user.options.get( 'editfont' ) );

			surfaceView.$documentNode.removeClass(
				've-ce-documentNode-codeEditor-webkit-hide ve-ce-documentNode-codeEditor-hide'
			);
			// Reset gutter.
			surfaceView.$documentNode.css( 'margin-left', '' );

			const mirrorElement = surface.mirror.getWrapperElement();
			mirrorElement.parentNode.removeChild( mirrorElement );
		}

		surface.mirror = null;
	}

	return true;
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

	this.surface.mirror.setSelection( this.getPosFromOffset( range.from ) );
};

/**
 * Handle langChange events from the document view
 */
ve.ui.CodeMirrorAction.prototype.onLangChange = function () {
	const surface = this.surface,
		doc = surface.getView().getDocument(),
		dir = doc.getDir(), lang = doc.getLang();

	surface.mirror.setOption( 'direction', dir );

	// Set the wrapper to the appropriate language (T341342)
	surface.mirror.getWrapperElement().setAttribute( 'lang', lang );
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
		store = this.surface.getModel().getDocument().getStore(),
		mirror = this.surface.mirror;

	let offset = 0;
	tx.operations.forEach( ( op ) => {
		if ( op.type === 'retain' ) {
			offset += op.length;
		} else if ( op.type === 'replace' ) {
			replacements.push( {
				start: this.getPosFromOffset( offset ),
				// Don't bother recalculating end offset if not a removal, replaceRange works with just one arg
				end: op.remove.length ? this.getPosFromOffset( offset + op.remove.length ) : undefined,
				data: new ve.dm.ElementLinearData( store, op.insert ).getSourceText()
			} );
			offset += op.remove.length;
		}
	} );

	// Apply replacements in reverse to avoid having to shift offsets
	for ( let i = replacements.length - 1; i >= 0; i-- ) {
		mirror.replaceRange(
			replacements[ i ].data,
			replacements[ i ].start,
			replacements[ i ].end
		);
	}

	// HACK: The absolutely positioned CodeMirror doesn't calculate the viewport
	// correctly when expanding from less than the viewport height.  (T185184)
	if ( mirror.display.sizer.style.minHeight !== this.lastHeight ) {
		mirror.refresh();
		this.lastHeight = mirror.display.sizer.style.minHeight;
	}
};

/**
 * Convert a VE offset to a 2D CodeMirror position
 *
 * @param {number} veOffset VE linear model offset
 * @return {Object} Code mirror position, containing 'line' and 'ch' numbers
 */
ve.ui.CodeMirrorAction.prototype.getPosFromOffset = function ( veOffset ) {
	return this.surface.mirror.posFromIndex(
		this.surface.getModel().getSourceOffsetFromOffset( veOffset )
	);
};

/* Registration */

{
	// eslint-disable-next-line no-jquery/no-global-selector
	const contentDir = $( '.mw-body-content .mw-parser-output' ).attr( 'dir' ) ||
		// New pages will use wgPageContentLanguage which is set on the html element.
		document.documentElement.dir;

	if ( contentDir === 'ltr' ) {
		ve.ui.actionFactory.register( ve.ui.CodeMirrorAction );
	}
}
