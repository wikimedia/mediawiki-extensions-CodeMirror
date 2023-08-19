<?php

namespace MediaWiki\Extension\CodeMirror\Tests;

use MediaWiki\Extension\CodeMirror\Hooks;
use MediaWiki\Title\Title;
use MediaWiki\User\UserOptionsLookup;
use MediaWikiIntegrationTestCase;
use RequestContext;

/**
 * @group CodeMirror
 * @group Database
 * @coversDefaultClass \MediaWiki\Extension\CodeMirror\Hooks
 */
class HookTest extends MediaWikiIntegrationTestCase {

	/**
	 * @covers ::isCodeMirrorOnPage
	 * @covers ::onBeforePageDisplay
	 */
	public function testOnBeforePageDisplay() {
		$userOptionsLookup = $this->createMock( UserOptionsLookup::class );
		$userOptionsLookup->method( 'getOption' )->willReturn( true );
		$this->setService( 'UserOptionsLookup', $userOptionsLookup );

		$out = $this->createMock( \OutputPage::class );
		$out->method( 'getModules' )->willReturn( [] );
		$out->method( 'getUser' )->willReturn( $this->createMock( \User::class ) );
		$out->method( 'getActionName' )->willReturn( 'edit' );
		$out->method( 'getTitle' )->willReturn( Title::makeTitle( NS_MAIN, __METHOD__ ) );
		$out->expects( $this->exactly( 2 ) )->method( 'addModules' );

		( new Hooks( $userOptionsLookup ) )
			->onBeforePageDisplay( $out, $this->createMock( \Skin::class ) );
	}

	/**
	 * @covers ::onGetPreferences
	 */
	public function testPreferenceRegistered() {
		$user = self::getTestUser()->getUser();
		$this->setMwGlobals( 'wgTitle', Title::newFromText( __METHOD__ ) );
		$kinds = $this->getServiceContainer()->getUserOptionsManager()
			->getOptionKinds( $user, RequestContext::getMain(), [ 'usecodemirror' => 1 ] );
		self::assertEquals( 'registered', $kinds['usecodemirror'] );
	}
}
