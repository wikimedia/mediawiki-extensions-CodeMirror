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
		$wikiPage = new \WikiPage( \Title::makeTitle( NS_MAIN, __METHOD__ ) );
		$context = $this->createMock( \IContextSource::class );
		$context->method( 'getRequest' )->willReturn( new \FauxRequest( [ 'action' => 'edit' ] ) );
		$context->method( 'canUseWikiPage' )->willReturn( true );
		$context->method( 'getWikiPage' )->willReturn( $wikiPage );
		$context->method( 'getTitle' )->willReturn( $wikiPage->getTitle() );

		$user = $this->createMock( \User::class );
		$userOptionsLookup = $this->createMock( UserOptionsLookup::class );
		$userOptionsLookup->method( 'getOption' )->willReturn( true );
		$this->setService( 'UserOptionsLookup', $userOptionsLookup );

		$out = $this->createMock( \OutputPage::class );
		$out->method( 'getModules' )->willReturn( [] );
		$out->method( 'getContext' )->willReturn( $context );
		$out->method( 'getUser' )->willReturn( $user );
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
