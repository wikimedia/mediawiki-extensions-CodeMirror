<?php

namespace MediaWiki\Extension\CodeMirror\Tests;

use MediaWiki\Extension\CodeMirror\Hooks;
use MediaWiki\MediaWikiServices;
use MediaWiki\Request\WebRequest;
use MediaWiki\Title\Title;
use MediaWiki\User\UserOptionsLookup;
use MediaWikiIntegrationTestCase;
use OutputPage;
use RequestContext;
use Skin;

/**
 * @group CodeMirror
 * @group Database
 * @coversDefaultClass \MediaWiki\Extension\CodeMirror\Hooks
 */
class HookTest extends MediaWikiIntegrationTestCase {

	/**
	 * @covers ::isCodeMirrorOnPage
	 * @covers ::onBeforePageDisplay
	 * @param bool $useCodeMirrorV6
	 * @param int $expectedAddModuleCalls
	 * @param string $expectedFirstModule
	 * @dataProvider provideOnBeforePageDisplay
	 */
	public function testOnBeforePageDisplay(
		bool $useCodeMirrorV6, int $expectedAddModuleCalls, string $expectedFirstModule
	) {
		$this->overrideConfigValues( [
			'CodeMirrorV6' => $useCodeMirrorV6,
		] );
		$userOptionsLookup = $this->createMock( UserOptionsLookup::class );
		$userOptionsLookup->method( 'getOption' )->willReturn( true );
		$this->setService( 'UserOptionsLookup', $userOptionsLookup );

		$out = $this->createMock( OutputPage::class );
		$out->method( 'getModules' )->willReturn( [] );
		$out->method( 'getUser' )->willReturn( $this->createMock( \User::class ) );
		$out->method( 'getActionName' )->willReturn( 'edit' );
		$out->method( 'getTitle' )->willReturn( Title::makeTitle( NS_MAIN, __METHOD__ ) );
		$request = $this->createMock( WebRequest::class );
		$request->method( 'getRawVal' )->willReturn( null );
		$out->method( 'getRequest' )->willReturn( $request );
		$out->expects( $this->exactly( $expectedAddModuleCalls ) )
			->method( 'addModules' )
			->withConsecutive( [ $this->equalTo( $expectedFirstModule ) ] );

		( new Hooks( $userOptionsLookup, MediaWikiServices::getInstance()->getMainConfig() ) )
			->onBeforePageDisplay( $out, $this->createMock( Skin::class ) );
	}

	/**
	 * @return array[]
	 */
	public function provideOnBeforePageDisplay(): array {
		return [
			[ false, 2, 'ext.CodeMirror.WikiEditor' ],
			[ true, 1, 'ext.CodeMirror.v6.WikiEditor' ]
		];
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
