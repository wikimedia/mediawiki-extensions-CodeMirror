<?php

namespace MediaWiki\Extension\CodeMirror\Tests\Unit;

use MediaWiki\Extension\CodeMirror\Hooks\HookRunner;
use MediaWiki\Tests\HookContainer\HookRunnerTestBase;

/**
 * @covers \MediaWiki\Extension\CodeMirror\Hooks\HookRunner
 */
class HookRunnerTest extends HookRunnerTestBase {

	public static function provideHookRunners() {
		yield HookRunner::class => [ HookRunner::class ];
	}
}
