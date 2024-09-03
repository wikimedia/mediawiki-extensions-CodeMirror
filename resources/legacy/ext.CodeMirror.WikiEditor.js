function init() {
	const extCodeMirror = require( 'ext.CodeMirror' );
	let codeMirror, $textbox1, realtimePreviewHandler;

	let useCodeMirror = mw.user.options.get( 'usecodemirror' ) > 0;

	const originHooksTextarea = $.valHooks.textarea;
	// define jQuery hook for searching and replacing text using JS if CodeMirror is enabled, see Bug: T108711
	$.valHooks.textarea = {
		get: function ( elem ) {
			if ( elem.id === 'wpTextbox1' && codeMirror ) {
				return codeMirror.doc.getValue();
			} else if ( originHooksTextarea ) {
				return originHooksTextarea.get( elem );
			}
			return elem.value;
		},
		set: function ( elem, value ) {
			if ( elem.id === 'wpTextbox1' && codeMirror ) {
				return codeMirror.doc.setValue( value );
			} else if ( originHooksTextarea ) {
				return originHooksTextarea.set( elem, value );
			}
			elem.value = value;
		}
	};

	// jQuery.textSelection overrides for CodeMirror.
	// See jQuery.textSelection.js for method documentation
	const cmTextSelection = {
		getContents: function () {
			return codeMirror.doc.getValue();
		},
		setContents: function ( content ) {
			codeMirror.doc.setValue( content );
			return this;
		},
		getSelection: function () {
			return codeMirror.doc.getSelection();
		},
		setSelection: function ( options ) {
			codeMirror.doc.setSelection(
				codeMirror.doc.posFromIndex( options.start ),
				codeMirror.doc.posFromIndex( options.end )
			);
			codeMirror.focus();
			return this;
		},
		replaceSelection: function ( value ) {
			codeMirror.doc.replaceSelection( value );
			return this;
		},
		getCaretPosition: function ( options ) {
			const caretPos = codeMirror.doc.indexFromPos( codeMirror.doc.getCursor( true ) ),
				endPos = codeMirror.doc.indexFromPos( codeMirror.doc.getCursor( false ) );
			if ( options.startAndEnd ) {
				return [ caretPos, endPos ];
			}
			return caretPos;
		},
		scrollToCaretPosition: function () {
			codeMirror.scrollIntoView( null );
			return this;
		}
	};

	/**
	 * Save CodeMirror enabled pref.
	 *
	 * @param {boolean} prefValue True, if CodeMirror should be enabled by default, otherwise false.
	 */
	function setCodeEditorPreference( prefValue ) {
		useCodeMirror = prefValue; // Save state for function updateToolbarButton()
		extCodeMirror.setCodeEditorPreference( prefValue );
	}

	/**
	 * @return {boolean}
	 */
	function isLineNumbering() {
		// T285660: Backspace related bug on Android browsers as of 2021
		if ( /Android\b/.test( navigator.userAgent ) ) {
			return false;
		}

		const namespaces = mw.config.get( 'wgCodeMirrorLineNumberingNamespaces' );
		// Set to [] to disable everywhere, or null to enable everywhere
		return !namespaces ||
			namespaces.indexOf( mw.config.get( 'wgNamespaceNumber' ) ) !== -1;
	}

	// Keep these modules in sync with MediaWiki\Extension\CodeMirror\Hooks.php
	const codeMirrorCoreModules = [
		'ext.CodeMirror.lib',
		'ext.CodeMirror.mode.mediawiki'
	];

	/**
	 * Set the size of the CodeMirror element,
	 * and react to changes coming from WikiEditor (including Realtime Preview if its enabled).
	 */
	function setupSizing() {
		const $codeMirror = $( codeMirror.getWrapperElement() );

		// Only add resizing corner if realtime preview is enabled,
		// because that feature provides height resizing (even when preview isn't used).
		if ( mw.loader.getState( 'ext.wikiEditor.realtimepreview' ) === 'ready' ) {
			codeMirror.setSize( '100%', $textbox1.parent().height() );
		}
		const $resizableHandle = $codeMirror.find( '.ui-resizable-handle' );
		mw.hook( 'ext.WikiEditor.realtimepreview.enable' ).add( ( realtimePreview ) => {
			// CodeMirror may have been turned on and then off again before realtimepreview is enabled, in which case it will be null.
			if ( !codeMirror ) {
				return;
			}
			// Get rid of the corner resize handle, because realtimepreview provides its own.
			$resizableHandle.hide();
			// Add listener for CodeMirror changes.
			realtimePreviewHandler = realtimePreview.getEventHandler().bind( realtimePreview );
			codeMirror.on( 'change', realtimePreviewHandler );
			// Fix the width and height of the CodeMirror area.
			codeMirror.setSize( '100%', realtimePreview.twoPaneLayout.$element.height() );
		} );
		mw.hook( 'ext.WikiEditor.realtimepreview.resize' ).add( ( resizingBar ) => {
			// CodeMirror may have been turned off after realtimepreview was opened, in which case it will be null.
			if ( !codeMirror ) {
				return;
			}
			// Keep in sync with the height of the pane.
			codeMirror.setSize( '100%', resizingBar.getResizedPane().height() );
		} );
		mw.hook( 'ext.WikiEditor.realtimepreview.disable' ).add( () => {
			// Re-show the corner resize handle.
			$resizableHandle.show();
			// CodeMirror may have been turned off after realtimepreview was opened, in which case it will be null.
			if ( !codeMirror ) {
				return;
			}
			codeMirror.refresh(); // T305333
			codeMirror.off( 'change', realtimePreviewHandler );
		} );
	}

	/**
	 * Replaces the default textarea with CodeMirror
	 */
	function enableCodeMirror() {
		const config = mw.config.get( 'extCodeMirrorConfig' );
		mw.loader.using( codeMirrorCoreModules.concat( config.pluginModules ), () => {
			const selectionStart = $textbox1.prop( 'selectionStart' ),
				selectionEnd = $textbox1.prop( 'selectionEnd' ),
				scrollTop = $textbox1.scrollTop(),
				hasFocus = $textbox1.is( ':focus' );

			// If CodeMirror is already loaded or wikEd gadget is enabled, abort. See T178348.
			// FIXME: Would be good to replace the wikEd check with something more generic.
			if ( codeMirror || mw.user.options.get( 'gadget-wikEd' ) > 0 ) {
				return;
			}

			// T174055: Do not redefine the browser history navigation keys (T175378: for PC only)
			CodeMirror.keyMap.pcDefault[ 'Alt-Left' ] = false;
			CodeMirror.keyMap.pcDefault[ 'Alt-Right' ] = false;

			const cmOptions = {
				mwConfig: config,
				// styleActiveLine: true, // disabled since Bug: T162204, maybe should be optional
				lineWrapping: true,
				lineNumbers: isLineNumbering(),
				readOnly: $textbox1[ 0 ].readOnly,
				// select mediawiki as text input mode
				mode: 'text/mediawiki',
				extraKeys: {
					Tab: false,
					'Shift-Tab': false,
					// T174514: Move the cursor at the beginning/end of the current wrapped line
					Home: 'goLineLeft',
					End: 'goLineRight'
				},
				inputStyle: 'contenteditable',
				spellcheck: true,
				viewportMargin: Infinity
			};

			cmOptions.matchBrackets = {
				highlightNonMatching: false,
				maxHighlightLineLength: 10000
			};

			codeMirror = CodeMirror.fromTextArea( $textbox1[ 0 ], cmOptions );
			const $codeMirror = $( codeMirror.getWrapperElement() );

			codeMirror.on( 'focus', () => {
				$textbox1[ 0 ].dispatchEvent( new Event( 'focus' ) );
			} );
			codeMirror.on( 'blur', () => {
				$textbox1[ 0 ].dispatchEvent( new Event( 'blur' ) );
			} );
			mw.hook( 'editRecovery.loadEnd' ).add( ( data ) => {
				codeMirror.on( 'change', data.fieldChangeHandler );
			} );

			// Allow textSelection() functions to work with CodeMirror editing field.
			$codeMirror.textSelection( 'register', cmTextSelection );
			// Also override textSelection() functions for the "real" hidden textarea to route to CodeMirror.
			// We unregister this when switching to normal textarea mode.
			$textbox1.textSelection( 'register', cmTextSelection );

			setupSizing( $textbox1, codeMirror );

			if ( hasFocus ) {
				codeMirror.focus();
			}
			codeMirror.doc.setSelection( codeMirror.doc.posFromIndex( selectionEnd ), codeMirror.doc.posFromIndex( selectionStart ) );
			codeMirror.scrollTo( null, scrollTop );

			// HACK: <textarea> font size varies by browser (chrome/FF/IE)
			$codeMirror.css( {
				'font-size': $textbox1.css( 'font-size' ),
				'line-height': $textbox1.css( 'line-height' )
			} );

			// use direction and language of the original textbox
			$codeMirror.attr( {
				dir: $textbox1.attr( 'dir' ),
				lang: $textbox1.attr( 'lang' )
			} );

			$( codeMirror.getInputField() )
				// T259347: Use accesskey of the original textbox
				.attr( 'accesskey', $textbox1.attr( 'accesskey' ) )
				// T194102: UniversalLanguageSelector integration is buggy, disabling it completely
				.addClass( 'noime' );

			if ( mw.user.options.get( 'usecodemirror-colorblind' ) ) {
				$codeMirror.addClass( 'cm-mw-colorblind-colors' );
			}

			// T305333: Reload CodeMirror to fix a cursor caret issue.
			codeMirror.refresh();

			mw.hook( 'ext.CodeMirror.switch' ).fire( true, $codeMirror );
		} );
	}

	/**
	 * Updates CodeMirror button on the toolbar according to the current state (on/off)
	 */
	function updateToolbarButton() {
		// eslint-disable-next-line no-jquery/no-global-selector
		const $button = $( '#mw-editbutton-codemirror' );

		$button.toggleClass( 'mw-editbutton-codemirror-active', !!useCodeMirror );

		// WikiEditor2010 OOUI ToggleButtonWidget
		if ( $button.data( 'setActive' ) ) {
			$button.data( 'setActive' )( !!useCodeMirror );
		}
	}

	/**
	 * Enables or disables CodeMirror
	 */
	function switchCodeMirror() {
		let selectionObj, selectionStart, selectionEnd, scrollTop, hasFocus, $codeMirror;

		if ( codeMirror ) {
			scrollTop = codeMirror.getScrollInfo().top;
			selectionObj = codeMirror.doc.listSelections()[ 0 ];
			selectionStart = codeMirror.doc.indexFromPos( selectionObj.head );
			selectionEnd = codeMirror.doc.indexFromPos( selectionObj.anchor );
			hasFocus = codeMirror.hasFocus();
			$codeMirror = $( codeMirror.getWrapperElement() );
			setCodeEditorPreference( false );
			$codeMirror.textSelection( 'unregister' );
			$textbox1.textSelection( 'unregister' );
			codeMirror.toTextArea();
			codeMirror = null;
			if ( hasFocus ) {
				$textbox1.trigger( 'focus' );
			}
			$textbox1.prop( 'selectionStart', selectionStart );
			$textbox1.prop( 'selectionEnd', selectionEnd );
			$textbox1.scrollTop( scrollTop );

			mw.hook( 'ext.CodeMirror.switch' ).fire( false, $textbox1 );
		} else {
			enableCodeMirror();
			setCodeEditorPreference( true );
		}
		updateToolbarButton();

		extCodeMirror.logUsage( {
			editor: 'wikitext',
			enabled: codeMirror !== null,
			toggled: true,
			// eslint-disable-next-line no-jquery/no-global-selector,camelcase
			edit_start_ts_ms: parseInt( $( 'input[name="wpStarttime"]' ).val() ) * 1000 || 0
		} );
	}

	/**
	 * Adds the CodeMirror button to WikiEditor
	 */
	function addCodeMirrorToWikiEditor() {
		const context = $textbox1.data( 'wikiEditor-context' ),
			toolbar = context && context.modules && context.modules.toolbar;

		// Guard against something having removed WikiEditor (T271457)
		if ( !toolbar ) {
			return;
		}

		$textbox1.wikiEditor(
			'addToToolbar',
			{
				section: 'main',
				groups: {
					codemirror: {
						tools: {
							CodeMirror: {
								label: mw.msg( 'codemirror-toggle-label' ),
								type: 'toggle',
								oouiIcon: 'highlight',
								action: {
									type: 'callback',
									execute: function () {
										switchCodeMirror();
									}
								}
							}
						}
					}
				}
			}
		);

		const $codeMirrorButton = toolbar.$toolbar.find( '.tool[rel=CodeMirror]' );
		$codeMirrorButton
			.attr( 'id', 'mw-editbutton-codemirror' );

		if ( useCodeMirror ) {
			enableCodeMirror();
		}
		updateToolbarButton();

		extCodeMirror.logUsage( {
			editor: 'wikitext',
			enabled: useCodeMirror,
			toggled: false,
			// eslint-disable-next-line no-jquery/no-global-selector,camelcase
			edit_start_ts_ms: parseInt( $( 'input[name="wpStarttime"]' ).val() ) * 1000 || 0
		} );
	}

	// Add CodeMirror button to the enhanced editing toolbar.
	mw.hook( 'wikiEditor.toolbarReady' ).add( ( $textarea ) => {
		$textbox1 = $textarea;
		addCodeMirrorToWikiEditor();
	} );

	// Synchronize textarea with CodeMirror before leaving
	window.addEventListener( 'beforeunload', () => {
		if ( codeMirror ) {
			codeMirror.save();
		}
	} );
}

if ( mw.loader.getState( 'ext.wikiEditor' ) ) {
	init();
}
