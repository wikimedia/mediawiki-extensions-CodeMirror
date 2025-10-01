<?php

namespace MediaWiki\Extension\CodeMirror\Hooks;

use MediaWiki\HookContainer\HookContainer;
use MediaWiki\SpecialPage\SpecialPage;
use MediaWiki\Title\Title;

/**
 * This is a hook runner class, see docs/Hooks.md in core.
 * @internal
 */
class HookRunner implements CodeMirrorGetModeHook, CodeMirrorSpecialPageHook {
	public function __construct(
		private readonly HookContainer $hookContainer,
	) {
	}

	/**
	 * @inheritDoc
	 */
	public function onCodeMirrorGetMode( Title $title, ?string &$mode, string $model ): bool {
		return $this->hookContainer->run( 'CodeMirrorGetMode', [ $title, &$mode, $model ] );
	}

	/**
	 * @inheritDoc
	 */
	public function onCodeMirrorSpecialPage( SpecialPage $special, array &$textareas ): bool {
		return $this->hookContainer->run( 'CodeMirrorSpecialPage', [ $special, &$textareas ] );
	}
}
