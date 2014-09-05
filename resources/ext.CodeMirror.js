/*global CodeMirror, mw*/
jQuery( document ).ready( function ( $ ) {
	var textbox1 = $( '#wpTextbox1' );
	var codeMirror = CodeMirror.fromTextArea( textbox1[0], {
			mwextFunctionSynonyms: mw.config.get( 'extCodeMirrorFunctionSynonyms' ),
			mwextTags: mw.config.get( 'extCodeMirrorTags' ),
			mwextDoubleUnderscore: mw.config.get( 'extCodeMirrorDoubleUnderscore' ),
			styleActiveLine: true,
			//lineNumbers: true,
			lineWrapping: true,
			//indentUnit: 4,
			//indentWithTabs: true
			//matchBrackets: true,
			//autoCloseBrackets: true,
			mode: 'text/mediawiki'
		} );
	codeMirror.setSize( null, textbox1.height() );

	// Replace jquery.textSelection.js
	$.fn.textSelection = function ( command, options ) {
		var fn, retval;

		fn = {
			/**
			 * Get the contents of the textarea
			 */
			getContents: function () {
				return codeMirror.doc.getValue();
			},

			/**
			 * Get the currently selected text in this textarea. Will focus the textarea
			 * in some browsers (IE/Opera)
			 */
			getSelection: function () {
				return codeMirror.doc.getSelection();
			},

			/**
			 * Inserts text at the beginning and end of a text selection, optionally
			 * inserting text at the caret when selection is empty.
			 */
			encapsulateSelection: function ( options ) {
				return this.each( function () {
					var insertText, selText,
							selectPeri = options.selectPeri,
							pre = options.pre, post = options.post;

					if ( options.selectionStart !== undefined ) {
						//fn[command].call( this, options );
						fn.setSelection( { 'start': options.selectionStart, 'end': options.selectionEnd } ); // not tested
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
					*/
					function doSplitLines( selText, pre, post ) {
						var i,
							insertText = '',
							selTextArr = selText.split( '\n' );
						for ( i = 0; i < selTextArr.length; i++ ) {
							insertText += pre + selTextArr[i] + post;
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

					var startCursor = codeMirror.doc.getCursor( true );
					if ( options.ownline ) {
						if ( startCursor.ch !== 0 ) {
							insertText = '\n' + insertText;
							pre += '\n';
						}
						var endCursor = codeMirror.doc.getCursor( false );
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
				});
			},

			/**
			 * Get the position (in resolution of bytes not necessarily characters)
			 * in a textarea
			 */
			getCaretPosition: function ( options ) {
				var caretPos = codeMirror.doc.indexFromPos( codeMirror.doc.getCursor( true ) );
				if ( options.startAndEnd ) {
					var endPos = codeMirror.doc.indexFromPos( codeMirror.doc.getCursor( false ) );
					return [ caretPos, endPos ];
				}
				return caretPos;
			},

			 setSelection: function ( options ) {
				return this.each( function () {
					codeMirror.doc.setSelection( codeMirror.doc.posFromIndex( options.start ), codeMirror.doc.posFromIndex( options.end ) );
				});
			 },

			/**
			* Scroll a textarea to the current cursor position. You can set the cursor
			* position with setSelection()
			* @param options boolean Whether to force a scroll even if the caret position
			*  is already visible. Defaults to false
			*/
			scrollToCaretPosition: function ( /* options */ ) {
				return this.each(function () {
					codeMirror.scrollIntoView( null );
				});
			}
		};

		switch ( command ) {
			//case 'getContents': // no params
			//case 'setContents': // no params with defaults
			//case 'getSelection': // no params
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

		retval = fn[command].call( this, options );
		codeMirror.focus();

		return retval;
	};

	//$( codeMirror.getInputField() ).data( 'wikiEditor-context', {fn: fn, $iframe: false} );
} );
