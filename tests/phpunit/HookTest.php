<?php

namespace MediaWiki\Extension\CodeMirror\Tests;

use MediaWiki\Extension\CodeMirror\Hooks;
use MediaWiki\MediaWikiServices;
use MediaWiki\User\UserOptionsLookup;
use MediaWikiIntegrationTestCase;
use RequestContext;

/**
 * @group CodeMirror
 */
class HookTest extends MediaWikiIntegrationTestCase {

	/**
	 * @covers \MediaWiki\Extension\CodeMirror\Hooks::isCodeMirrorOnPage
	 * @covers \MediaWiki\Extension\CodeMirror\Hooks::onBeforePageDisplay
	 */
	public function testOnBeforePageDisplay() {
		$userOptionsLookup = $this->createMock( UserOptionsLookup::class );
		$userOptionsLookup->method( 'getOption' )->willReturn( true );
		$this->setService( 'UserOptionsLookup', $userOptionsLookup );

		$out = $this->createMock( \OutputPage::class );
		$out->method( 'getModules' )->willReturn( [] );
		$out->method( 'getUser' )->willReturn( $this->createMock( \User::class ) );
		$out->method( 'getActionName' )->willReturn( 'edit' );
		$out->method( 'getTitle' )->willReturn( \Title::makeTitle( NS_MAIN, __METHOD__ ) );
		$out->expects( $this->exactly( 2 ) )->method( 'addModules' );

		Hooks::onBeforePageDisplay( $out, $this->createMock( \Skin::class ) );
	}

	/**
	 * @covers \MediaWiki\Extension\CodeMirror\Hooks::onGetPreferences
	 */
	public function testPreferenceRegistered() {
		$user = self::getTestUser()->getUser();
		$this->setMwGlobals( 'wgTitle', \Title::newFromText( __METHOD__ ) );
		$kinds = MediaWikiServices::getInstance()->getUserOptionsManager()
			->getOptionKinds( $user, RequestContext::getMain(), [ 'usecodemirror' => 1 ] );
		self::assertEquals( 'registered', $kinds['usecodemirror'] );
	}
}
