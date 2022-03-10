( function () {
	var codeMirror, $textbox1;

	// Exit if WikiEditor is disabled
	if ( !mw.loader.getState( 'ext.wikiEditor' ) ) {
		return;
	}

	var useCodeMirror = mw.user.options.get( 'usecodemirror' ) > 0;
	var api = new mw.Api();

	var originHooksTextarea = $.valHooks.textarea;
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
	var cmTextSelection = {
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
			codeMirror.doc.setSelection( codeMirror.doc.posFromIndex( options.start ), codeMirror.doc.posFromIndex( options.end ) );
			codeMirror.focus();
			return this;
		},
		replaceSelection: function ( value ) {
			codeMirror.doc.replaceSelection( value );
			return this;
		},
		getCaretPosition: function ( options ) {
			var caretPos = codeMirror.doc.indexFromPos( codeMirror.doc.getCursor( true ) ),
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

		if ( mw.user.isAnon() ) { // Skip it for anon users
			return;
		}
		api.saveOption( 'usecodemirror', prefValue ? 1 : 0 );
		mw.user.options.set( 'usecodemirror', prefValue ? 1 : 0 );
	}

	/**
	 * @return {boolean}
	 */
	function isLineNumbering() {
		// T285660: Backspace related bug on Android browsers as of 2021
		if ( /Android\b/.test( navigator.userAgent ) ) {
			return false;
		}

		var namespaces = mw.config.get( 'wgCodeMirrorLineNumberingNamespaces' );
		// Set to [] to disable everywhere, or null to enable everywhere
		return !namespaces ||
			namespaces.indexOf( mw.config.get( 'wgNamespaceNumber' ) ) !== -1;
	}

	// Keep these modules in sync with CodeMirrorHooks.php
	var codeMirrorCoreModules = [
		'ext.CodeMirror.lib',
		'ext.CodeMirror.mode.mediawiki'
	];

	/**
	 * Replaces the default textarea with CodeMirror
	 */
	function enableCodeMirror() {
		var config = mw.config.get( 'extCodeMirrorConfig' );

		mw.loader.using( codeMirrorCoreModules.concat( config.pluginModules ), function () {
			var $codeMirror, cmOptions,
				selectionStart = $textbox1.prop( 'selectionStart' ),
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

			cmOptions = {
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

			if ( mw.config.get( 'wgCodeMirrorEnableBracketMatching' ) ) {
				cmOptions.matchBrackets = {
					highlightNonMatching: false,
					maxHighlightLineLength: 10000
				};
			}

			codeMirror = CodeMirror.fromTextArea( $textbox1[ 0 ], cmOptions );
			$codeMirror = $( codeMirror.getWrapperElement() );

			codeMirror.on( 'focus', function () {
				$textbox1.triggerHandler( 'focus' );
			} );
			codeMirror.on( 'blur', function () {
				$textbox1.triggerHandler( 'blur' );
			} );

			// Allow textSelection() functions to work with CodeMirror editing field.
			$codeMirror.textSelection( 'register', cmTextSelection );
			// Also override textSelection() functions for the "real" hidden textarea to route to
			// CodeMirror. We unregister this when switching to normal textarea mode.
			$textbox1.textSelection( 'register', cmTextSelection );

			// RL module jquery.ui
			$codeMirror.resizable( {
				handles: 'se',
				resize: function ( event, ui ) {
					ui.size.width = ui.originalSize.width;
				}
			} );

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

			// set the height of the textarea
			codeMirror.setSize( null, $textbox1.height() );

			if ( mw.config.get( 'wgCodeMirrorAccessibilityColors' ) ) {
				$codeMirror.addClass( 'cm-mw-accessible-colors' );
			}

			mw.hook( 'ext.CodeMirror.switch' ).fire( true, $codeMirror );
		} );
	}

	function logUsage( data ) {
		var event, editCountBucket;

		/* eslint-disable camelcase */
		event = $.extend( {
			session_token: mw.user.sessionId(),
			user_id: mw.user.getId()
		}, data );
		editCountBucket = mw.config.get( 'wgUserEditCountBucket' );
		if ( editCountBucket !== null ) {
			event.user_edit_count_bucket = editCountBucket;
		}
		/* eslint-enable camelcase */
		mw.track( 'event.CodeMirrorUsage', event );
	}

	/**
	 * Updates CodeMirror button on the toolbar according to the current state (on/off)
	 */
	function updateToolbarButton() {
		// eslint-disable-next-line no-jquery/no-global-selector
		var $button = $( '#mw-editbutton-codemirror' );

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
		var selectionObj, selectionStart, selectionEnd, scrollTop, hasFocus, $codeMirror;

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

		logUsage( {
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
		var $codeMirrorButton,
			context = $textbox1.data( 'wikiEditor-context' ),
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

		$codeMirrorButton = toolbar.$toolbar.find( '.tool[rel=CodeMirror]' );
		$codeMirrorButton
			.attr( 'id', 'mw-editbutton-codemirror' );

		if ( useCodeMirror ) {
			enableCodeMirror();
		}
		updateToolbarButton();

		logUsage( {
			editor: 'wikitext',
			enabled: useCodeMirror,
			toggled: false,
			// eslint-disable-next-line no-jquery/no-global-selector,camelcase
			edit_start_ts_ms: parseInt( $( 'input[name="wpStarttime"]' ).val() ) * 1000 || 0
		} );
	}

	$( function () {
		// Add CodeMirror button to the enhanced editing toolbar.
		mw.hook( 'wikiEditor.toolbarReady' ).add( function ( $textarea ) {
			$textbox1 = $textarea;
			addCodeMirrorToWikiEditor();
		} );
	} );

	// Synchronize textarea with CodeMirror before leaving
	window.addEventListener( 'beforeunload', function () {
		if ( codeMirror ) {
			codeMirror.save();
		}
	} );

}() );
