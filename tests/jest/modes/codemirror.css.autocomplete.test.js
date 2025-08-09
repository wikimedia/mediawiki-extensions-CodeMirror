/* eslint-disable-next-line n/no-missing-require */
const { CompletionContext } = require( 'ext.CodeMirror.v6.lib' );
const CodeMirror = require( '../../../resources/codemirror.js' );
const { css } = require( '../../../resources/modes/codemirror.css.js' );

// Setup CodeMirror instance.
const textarea = document.createElement( 'textarea' );
document.body.appendChild( textarea );
const cm = new CodeMirror( textarea, css() );
cm.initialize();
const [ source ] = cm.view.state.languageDataAt( 'autocomplete' );

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

describe( 'CSS autocomplete', () => {
	it( 'should boost supported CSS property values', () => {
		cm.view.dispatch( {
			changes: { from: 0, to: cm.view.state.doc.length, insert: 'a { top: i' },
			selection: { anchor: 10, head: 10 }
		} );
		expect(
			source( createCompletionContext() ).options.filter( ( { boost } ) => boost > 0 )
		).toEqual( [
			{ label: 'inherit', type: 'keyword', boost: 50 },
			{ label: 'initial', type: 'keyword', boost: 50 }
		] );
	} );
} );
