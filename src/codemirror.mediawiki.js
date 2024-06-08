import CodeMirror from './codemirror';
import mediaWikiLang from './codemirror.mode.mediawiki';

const textarea = document.getElementById( 'wpTextbox1' );
const cm = new CodeMirror( textarea );
// TODO: remove URL feature flag once bidi isolation is more stable.
const urlParams = new URLSearchParams( window.location.search );
cm.initialize( [
	cm.defaultExtensions,
	mediaWikiLang( {
		bidiIsolation: urlParams.get( 'cm6bidi' )
	} )
] );
