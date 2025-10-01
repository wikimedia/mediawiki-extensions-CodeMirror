<?php
declare( strict_types = 1 );

namespace MediaWiki\Extension\CodeMirror\Hooks;

use MediaWiki\SpecialPage\SpecialPage;

/**
 * This is a hook handler interface, see docs/Hooks.md in core.
 * Use the hook name "CodeMirrorSpecialPage" to register handlers implementing this interface.
 *
 * @stable to implement
 * @ingroup Hooks
 */
interface CodeMirrorSpecialPageHook {
	/**
	 * Allows to load CodeMirror on special pages.
	 *
	 * @param SpecialPage $special The special page
	 * @param array &$textareas The textareas to load CodeMirror on
	 * @return bool True to continue or false to abort
	 */
	public function onCodeMirrorSpecialPage( SpecialPage $special, array &$textareas ): bool;
}
