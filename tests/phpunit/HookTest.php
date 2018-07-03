<?php

namespace CodeMirror\Tests;

use MediaWikiTestCase;
use RequestContext;

/**
 * @group CodeMirror
 */
class HookTest extends MediaWikiTestCase {
	/**
	 * @covers CodeMirrorHooks::onGetPreferences()
	 */
	public function testPreferenceRegistered() {
		$user = self::getTestUser()->getUser();
		$this->setMwGlobals( 'wgTitle', \Title::newFromText( __METHOD__ ) );
		$kinds = $user->getOptionKinds( RequestContext::getMain(), [ 'usecodemirror' => 1 ] );
		self::assertEquals( 'registered', $kinds['usecodemirror'] );
	}
}
