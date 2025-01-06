const CodeMirror = require( '../../resources/codemirror.js' );
const CodeMirrorKeymap = require( '../../resources/codemirror.keymap.js' );

describe( 'CodeMirrorKeymap', () => {
	const shortcutTestCases = [
		{
			shortcut: 'Mod-y',
			platform: 'Mac',
			expected: '<kbd class="cm-mw-keymap-key"><kbd>⌘ Cmd</kbd>+<kbd>y</kbd></kbd>'
		},
		{
			shortcut: 'Cmd-y',
			platform: 'Mac',
			expected: '<kbd class="cm-mw-keymap-key"><kbd>⌘ Cmd</kbd>+<kbd>y</kbd></kbd>'
		},
		{
			shortcut: 'Mod-y',
			platform: 'Windows',
			expected: '<kbd class="cm-mw-keymap-key"><kbd>Ctrl</kbd>+<kbd>y</kbd></kbd>'
		},
		{
			shortcut: 'Mod-K',
			platform: 'Mac',
			expected: '<kbd class="cm-mw-keymap-key"><kbd>⌘ Cmd</kbd>+<kbd>Shift</kbd>+<kbd>k</kbd></kbd>'
		},
		{
			shortcut: 'Cmd-Alt-[',
			platform: 'Mac',
			expected: '<kbd class="cm-mw-keymap-key"><kbd>⌘ Cmd</kbd>+<kbd>⌥ Option</kbd>+<kbd>[</kbd></kbd>'
		},
		{
			shortcut: 'Ctrl-Alt-[',
			platform: 'Linux',
			expected: '<kbd class="cm-mw-keymap-key"><kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>[</kbd></kbd>'
		}
	];
	it.each( shortcutTestCases )( 'should return the correct HTML for $shortcut on $platform', ( { shortcut, platform, expected } ) => {
		// eslint-disable-next-line n/no-unsupported-features/node-builtins
		Object.defineProperty( global.navigator, 'platform', {
			value: platform,
			writable: true
		} );
		const cmKeymap = new CodeMirrorKeymap();
		expect( cmKeymap.getShortcutHtml( shortcut ).outerHTML ).toStrictEqual( expected );
	} );
} );

describe( 'CodeMirrorKeymap (integration)', () => {
	let textarea;

	beforeEach( () => {
		textarea = document.createElement( 'textarea' );
		const form = document.createElement( 'form' );
		form.appendChild( textarea );
	} );

	it( 'should register a keybinding with an EditorView', () => {
		// eslint-disable-next-line n/no-unsupported-features/node-builtins
		Object.defineProperty( global.navigator, 'platform', {
			value: 'Windows',
			writable: true
		} );
		const cm = new CodeMirror( textarea );
		cm.initialize();
		const cmKeymap = new CodeMirrorKeymap();
		const run = jest.fn();
		cmKeymap.registerKeyBinding( {
			key: 'Ctrl-Shift-H',
			run
		}, cm.view );
		// Simulate the keydown event
		cm.view.contentDOM.dispatchEvent( new KeyboardEvent( 'keydown', { key: 'H', shiftKey: true, ctrlKey: true } ) );
		expect( run ).toHaveBeenCalled();
	} );

	it( 'should show a help dialog with the Mod-Shift-/ keystroke', () => {
		mw.loader.using = jest.fn().mockReturnValue( {
			then: ( callback ) => callback()
		} );
		const cm = new CodeMirror( textarea );
		cm.initialize();
		cm.view.contentDOM.dispatchEvent( new KeyboardEvent( 'keydown', { key: '/', shiftKey: true, ctrlKey: true } ) );
		expect( document.querySelector( '.cm-mw-keymap-dialog' ) ).not.toBeNull();
		expect( document.querySelectorAll( 'dl.cm-mw-keymap-list dt' ).length ).toStrictEqual( 19 );
	} );
} );
