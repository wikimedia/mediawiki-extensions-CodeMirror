<?php
declare( strict_types = 1 );

namespace MediaWiki\Extension\CodeMirror\Hooks;

use MediaWiki\Title\Title;

/**
 * This is a hook handler interface, see docs/Hooks.md in core.
 * Use the hook name "CodeMirrorGetMode" to register handlers implementing this interface.
 *
 * @stable to implement
 * @ingroup Hooks
 */
interface CodeMirrorGetModeHook {
	/**
	 * Allows to set a code language for extensions content models
	 *
	 * @param Title $title The title the language is for
	 * @param string|null &$mode The CodeMirror mode to use
	 * @param string $model The content model of the title
	 * @return bool True to continue or false to abort
	 */
	public function onCodeMirrorGetMode( Title $title, ?string &$mode, string $model ): bool;
}
