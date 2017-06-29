( function ( mw, $ ) {
	var origTextSelection, useCodeMirror, codeMirror, api, originHooksTextarea,
		wikiEditorToolbarEnabled, popupStatus = null, popup = false;

	if ( mw.config.get( 'wgCodeEditorCurrentLanguage' ) ) { // If the CodeEditor is used then just exit;
		return;
	}

	// codeMirror needs a special textselection jQuery function to work, save the current one to restore when
	// CodeMirror get's disabled.
	origTextSelection = $.fn.textSelection;
	useCodeMirror = mw.user.options.get( 'usecodemirror' ) > 0;
	api = new mw.Api();
	originHooksTextarea = $.valHooks.textarea;
	// The WikiEditor extension exists the WikiEditor beta toolbar is used by the user
	wikiEditorToolbarEnabled = !!mw.loader.getState( 'ext.wikiEditor' ) &&
		// This can be the string "0" if the user disabled the preference - Bug T54542#555387
		mw.user.options.get( 'usebetatoolbar' ) > 0;

	// function for a textselection function for CodeMirror
	function cmTextSelection( command, options ) {
		var fn, retval;

		if ( !codeMirror || codeMirror.getTextArea() !== this[ 0 ] ) {
			return origTextSelection.call( this, command, options );
		}

		fn = {
			/**
			 * Get the contents of the textarea
			 *
			 * @return {string}
			 */
			getContents: function () {
				return codeMirror.doc.getValue();
			},

			setContents: function ( newContents ) {
				codeMirror.doc.setValue( newContents );
			},

			/**
			 * Get the currently selected text in this textarea. Will focus the textarea
			 * in some browsers (IE/Opera)
			 *
			 * @return {string}
			 */
			getSelection: function () {
				return codeMirror.doc.getSelection();
			},

			/**
			 * Inserts text at the beginning and end of a text selection, optionally
			 * inserting text at the caret when selection is empty.
			 *
			 * @param {Object} options
			 * @return {jQuery}
			 */
			encapsulateSelection: function ( options ) {
				return this.each( function () {
					var insertText,
						selText,
						selectPeri = options.selectPeri,
						pre = options.pre,
						post = options.post,
						startCursor = codeMirror.doc.getCursor( true ),
						endCursor = codeMirror.doc.getCursor( false );

					if ( options.selectionStart !== undefined ) {
						// fn[command].call( this, options );
						fn.setSelection( { start: options.selectionStart, end: options.selectionEnd } ); // not tested
					}

					selText = codeMirror.doc.getSelection();
					if ( !selText ) {
						selText = options.peri;
					} else if ( options.replace ) {
						selectPeri = false;
						selText = options.peri;
					} else {
						selectPeri = false;
						while ( selText.charAt( selText.length - 1 ) === ' ' ) {
							// Exclude ending space char
							selText = selText.substring( 0, selText.length - 1 );
							post += ' ';
						}
						while ( selText.charAt( 0 ) === ' ' ) {
							// Exclude prepending space char
							selText = selText.substring( 1, selText.length );
							pre = ' ' + pre;
						}
					}

					/**
					* Do the splitlines stuff.
					*
					* Wrap each line of the selected text with pre and post
					*
					* @param {string} selText
					* @param {string} pre
					* @param {string} post
					* @return {string}
					*/
					function doSplitLines( selText, pre, post ) {
						var i,
							insertText = '',
							selTextArr = selText.split( '\n' );

						for ( i = 0; i < selTextArr.length; i++ ) {
							insertText += pre + selTextArr[ i ] + post;
							if ( i !== selTextArr.length - 1 ) {
								insertText += '\n';
							}
						}
						return insertText;
					}

					if ( options.splitlines ) {
						selectPeri = false;
						insertText = doSplitLines( selText, pre, post );
					} else {
						insertText = pre + selText + post;
					}

					if ( options.ownline ) {
						if ( startCursor.ch !== 0 ) {
							insertText = '\n' + insertText;
							pre += '\n';
						}

						if ( codeMirror.doc.getLine( endCursor.line ).length !== endCursor.ch ) {
							insertText += '\n';
							post += '\n';
						}
					}

					codeMirror.doc.replaceSelection( insertText );

					if ( selectPeri ) {
						codeMirror.doc.setSelection(
							codeMirror.doc.posFromIndex( codeMirror.doc.indexFromPos( startCursor ) + pre.length ),
							codeMirror.doc.posFromIndex( codeMirror.doc.indexFromPos( startCursor ) + pre.length + selText.length )
						);
					}
				} );
			},

			/**
			 * Get the position (in resolution of bytes not necessarily characters)
			 * in a textarea
			 *
			 * @param {Object} options
			 * @return {number}
			 */
			getCaretPosition: function ( options ) {
				var caretPos = codeMirror.doc.indexFromPos( codeMirror.doc.getCursor( true ) ),
					endPos = codeMirror.doc.indexFromPos( codeMirror.doc.getCursor( false ) );
				if ( options.startAndEnd ) {
					return [ caretPos, endPos ];
				}
				return caretPos;
			},

			setSelection: function ( options ) {
				return this.each( function () {
					codeMirror.doc.setSelection( codeMirror.doc.posFromIndex( options.start ), codeMirror.doc.posFromIndex( options.end ) );
				} );
			},

			/**
			* Scroll a textarea to the current cursor position. You can set the cursor
			* position with setSelection()
			*
			* @return {jQuery}
			*/
			scrollToCaretPosition: function () {
				return this.each( function () {
					codeMirror.scrollIntoView( null );
				} );
			}
		};

		switch ( command ) {
			// case 'getContents': // no params
			// case 'setContents': // no params with defaults
			// case 'getSelection': // no params
			case 'encapsulateSelection':
				options = $.extend( {
					pre: '', // Text to insert before the cursor/selection
					peri: '', // Text to insert between pre and post and select afterwards
					post: '', // Text to insert after the cursor/selection
					ownline: false, // Put the inserted text on a line of its own
					replace: false, // If there is a selection, replace it with peri instead of leaving it alone
					selectPeri: true, // Select the peri text if it was inserted (but not if there was a selection and replace==false, or if splitlines==true)
					splitlines: false, // If multiple lines are selected, encapsulate each line individually
					selectionStart: undefined, // Position to start selection at
					selectionEnd: undefined // Position to end selection at. Defaults to start
				}, options );
				break;
			case 'getCaretPosition':
				options = $.extend( {
					// Return [start, end] instead of just start
					startAndEnd: false
				}, options );
				// FIXME: We may not need character position-based functions if we insert markers in the right places
				break;
			case 'setSelection':
				options = $.extend( {
					// Position to start selection at
					start: undefined,
					// Position to end selection at. Defaults to start
					end: undefined,
					// Element to start selection in (iframe only)
					startContainer: undefined,
					// Element to end selection in (iframe only). Defaults to startContainer
					endContainer: undefined
				}, options );

				if ( options.end === undefined ) {
					options.end = options.start;
				}
				if ( options.endContainer === undefined ) {
					options.endContainer = options.startContainer;
				}
				// FIXME: We may not need character position-based functions if we insert markers in the right places
				break;
			case 'scrollToCaretPosition':
				options = $.extend( {
					force: false // Force a scroll even if the caret position is already visible
				}, options );
				break;
		}

		retval = fn[ command ].call( this, options );
		if ( command === 'setSelection' ) {
			codeMirror.focus();
		}

		return retval;
	}

	/**
	 * Adds the CodeMirror button to WikiEditor
	 */
	function addCodeMirrorToWikiEditor() {
		var $codeMirrorButton;

		$( '#wpTextbox1' ).wikiEditor(
			'addToToolbar',
			{
				section: 'main',
				groups: {
					codemirror: {
						tools: {
							CodeMirror: {
								label: mw.msg( 'codemirror-toggle-label' ),
								type: 'button',
								action: {
									type: 'callback',
									execute: function () {
										// eslint-disable-next-line no-use-before-define
										switchCodeMirror();
									}
								}
							}
						}
					}
				}
			}
		);

		$codeMirrorButton = $( '#wpTextbox1' ).data( 'wikiEditor-context' ).modules.toolbar.$toolbar.find( 'a.tool[rel=CodeMirror]' );
		// FIXME in extensions/WikiEditor/modules/jquery.wikiEditor.toolbar.js
		$codeMirrorButton
			.css( 'background-image', '' )
			.attr( 'id', 'mw-editbutton-codemirror' );

		// eslint-disable-next-line no-use-before-define
		updateToolbarButton();
	}

	// define JQuery hook for searching and replacing text using JS if CodeMirror is enabled, see Bug: T108711
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

	/**
	 * Save CodeMirror enabled pref.
	 *
	 * @param {boolean} prefValue True, if CodeMirror should be enabled by default, otherwise false.
	 */
	function setCodeEditorPreference( prefValue ) {
		useCodeMirror = prefValue; // Save state for function updateToolbarIcon()

		if ( mw.user.isAnon() ) { // Skip it for anon users
			return;
		}
		api.saveOption( 'usecodemirror', prefValue ? 1 : 0 );
		mw.user.options.set( 'usecodemirror', prefValue ? 1 : 0 );
	}

	/**
	 * Updates CodeMirror button on the toolbar according to the current state (on/off)
	 */
	function updateToolbarButton() {
		$( '#mw-editbutton-codemirror' )
			.toggleClass( 'mw-editbutton-codemirror-on', !!useCodeMirror )
			.toggleClass( 'mw-editbutton-codemirror-off', !useCodeMirror );
	}

	/**
	 * Enables or disables CodeMirror
	 */
	function switchCodeMirror() {
		if ( codeMirror ) {
			setCodeEditorPreference( false );
			codeMirror.save();
			codeMirror.toTextArea();
			codeMirror = null;
			$.fn.textSelection = origTextSelection;

		} else {
			// eslint-disable-next-line no-use-before-define
			enableCodeMirror();
			setCodeEditorPreference( true );
		}
		updateToolbarButton();
	}

	/**
	 * Replaces the default textarea with CodeMirror
	 */
	function enableCodeMirror() {
		var config = mw.config.get( 'extCodeMirrorConfig' );

		if ( codeMirror ) {
			return;
		}

		mw.loader.using( config.pluginModules, function () {
			var $codeMirror,
				$textbox1 = $( '#wpTextbox1' );

			codeMirror = CodeMirror.fromTextArea( $textbox1[ 0 ], {
				mwConfig: config,
				// styleActiveLine: true, // disabled since Bug: T162204, maybe should be optional
				lineWrapping: true,
				readOnly: $textbox1[ 0 ].readOnly,
				// select mediawiki as text input mode
				mode: 'text/mediawiki',
				extraKeys: {
					Tab: false
				}
			} );
			$codeMirror = $( codeMirror.getWrapperElement() );

			// HACK: <textarea> font size varies by browser (chrome/FF/IE)
			$codeMirror.css( {
				'font-size': $textbox1.css( 'font-size' ),
				'line-height': $textbox1.css( 'line-height' )
			} );

			if ( !wikiEditorToolbarEnabled ) {
				$codeMirror.addClass( 'mw-codeMirror-classicToolbar' );
			}

			// set the height of the textarea
			codeMirror.setSize( null, $textbox1.height() );
			// Overwrite default textselection of WikiEditor to work with CodeMirror, too
			$.fn.textSelection = cmTextSelection;
		} );
	}

	/**
	 * Add a popup for first time users (T165003)
	 */
	function addPopup() {
		this.popuptext = '<div class=\'codemirror-popup-div\'>' +
			'<div class=\'codemirror-popup-top\'>{ <span class=\'codemirror-popup-color-blue\'>' +
			mw.msg( 'codemirror-popup-syntax' ) + '</span> ' +
			mw.msg( 'codemirror-popup-highlighting' ) + ' }</div>' +
			'<div class=\'codemirror-popup-text\'>' + mw.msg( 'codemirror-popup-desc' ) + '</div>' +
			'<div class=\'codemirror-popup-btn codemirror-popup-btn-yes\'>' + mw.msg( 'codemirror-popup-btn-yes' ) + '</div>' +
			'<div class=\'codemirror-popup-btn codemirror-popup-btn-no\'>' + mw.msg( 'codemirror-popup-btn-no' ) + '</div>' +
			'</div>';
		popup = new OO.ui.PopupWidget( {
			$content: $( this.popuptext ),
			containerPadding: 80,
			$floatableContainer: $( '#mw-editbutton-codemirror' ),
			padded: false,
			width: 215
		} );
		// Add our popup to the body, it will find its correct position using $floatableContainer
		$( 'body' ).append( popup.$element );

		// To display the popup, toggle the visibility to 'true'
		popup.toggle( true );
	}

	/* Check if view is in edit mode and that the required modules are available. Then, customize the toolbar … */
	if ( $.inArray( mw.config.get( 'wgAction' ), [ 'edit', 'submit' ] ) !== -1 ) {
		if ( wikiEditorToolbarEnabled ) {
			// Add our button
			if ( useCodeMirror ) {
				$( addCodeMirrorToWikiEditor );
			}
		} else {
			// Load wikiEditor's toolbar and add our button
			mw.loader.using( 'mediawiki.toolbar', function () {
				// If WikiEditor isn't enabled, add CodeMirror button to the default wiki editor toolbar
				mw.toolbar.addButton( {
					speedTip: mw.msg( 'codemirror-toggle-label' ),
					imageId: 'mw-editbutton-codemirror',
					onClick: function () {
						switchCodeMirror();
						return false;
					}
				} );
				// We don't know when button will be added, wait until the document is ready to update it
				$( function () {
					updateToolbarButton();
					// Is there already a local storage entry?
					// If so, we already showed them the popup, don't show again
					popupStatus = localStorage.getItem( 'codemirror-try-popup' );
					// If popup entry isn't in local storage, lets show them the popup
					if ( !popupStatus ) {
						try {
							localStorage.setItem( 'codemirror-try-popup', 1 );
							addPopup();
							$( '.codemirror-popup-btn-yes' ).click( function () {
								enableCodeMirror();
								setCodeEditorPreference( true );
								updateToolbarButton();
								popup.toggle( false );
							} );
							$( '.codemirror-popup-btn-no' ).click( function () {
								popup.toggle( false );
							} );
						} catch ( e ) {
							// No local storage or local storage full, don't show popup
						}
					}
				} );
			} );
		}
	}

	// enable CodeMirror
	if ( useCodeMirror ) {
		if ( wikiEditorToolbarEnabled ) {
			$( '#wpTextbox1' ).on( 'wikiEditor-toolbar-doneInitialSections', enableCodeMirror.bind( this ) );
		} else {
			enableCodeMirror();
		}
	}

}( mediaWiki, jQuery ) );
