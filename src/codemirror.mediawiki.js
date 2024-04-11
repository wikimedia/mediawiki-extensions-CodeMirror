import CodeMirror from './codemirror';
import mediaWikiLang from './codemirror.mode.mediawiki';

const textarea = document.getElementById( 'wpTextbox1' );
const cm = new CodeMirror( textarea );
cm.initialize( [
	cm.defaultExtensions,
	mediaWikiLang( { bidiIsolation: textarea.dir === 'rtl' } )
] );
