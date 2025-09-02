/* eslint-disable-next-line n/no-missing-require */
const { CompletionContext } = require( 'ext.CodeMirror.v6.lib' );
const CodeMirror = require( '../../../resources/codemirror.js' );
const { javascript } = require( '../../../resources/modes/codemirror.mode.exporter.js' );

// Setup CodeMirror instance.
const textarea = document.createElement( 'textarea' );
document.body.appendChild( textarea );
const cm = new CodeMirror( textarea, javascript() );
cm.initialize();
const [ ,, source ] = cm.view.state.languageDataAt( 'autocomplete' );

/**
 * Create a completion context at a specific position.
 *
 * @return {CompletionContext}
 */
const createCompletionContext = () => new CompletionContext(
	cm.view.state,
	/** @see https://github.com/codemirror/autocomplete/blob/62dead94d0f4b256f0b437b4733cfef6449e8453/src/completion.ts#L273 */
	cm.view.state.selection.main.from,
	true,
	cm.view
);

describe( 'JavaScript autocomplete', () => {
	it( 'should support scope completion', () => {
		cm.view.dispatch( {
			changes: { from: 0, to: cm.view.state.doc.length, insert: 'mw.storage.' },
			selection: { anchor: 11, head: 11 }
		} );
		expect( source( createCompletionContext() ) ).toEqual( {
			from: 11,
			options: [
				{ label: 'set', type: 'method', boost: -0 },
				{ label: 'get', type: 'method', boost: -0 },
				{ label: 'getObject', type: 'method', boost: -0 },
				{ label: 'setObject', type: 'method', boost: -0 }
			],
			validFor: /^[\w$\xa1-\uffff][\w$\d\xa1-\uffff]*$/
		} );
	} );
} );
