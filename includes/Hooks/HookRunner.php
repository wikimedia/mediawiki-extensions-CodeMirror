<?php

namespace MediaWiki\Extension\CodeMirror\Hooks;

use MediaWiki\HookContainer\HookContainer;
use MediaWiki\Title\Title;

/**
 * This is a hook runner class, see docs/Hooks.md in core.
 * @internal
 */
class HookRunner implements CodeMirrorGetModeHook {
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
}
