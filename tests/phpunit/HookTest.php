<?php

namespace CodeMirror\Tests;

use CodeMirrorHooks;
use MediaWiki\MediaWikiServices;
use MediaWikiTestCase;
use RequestContext;

/**
 * @group CodeMirror
 */
class HookTest extends MediaWikiTestCase {

	/**
	 * @covers \CodeMirrorHooks::isCodeMirrorOnPage
	 * @covers \CodeMirrorHooks::onBeforePageDisplay
	 */
	public function testOnBeforePageDisplay() {
		$wikiPage = new \WikiPage( \Title::makeTitle( NS_MAIN, __METHOD__ ) );
		$context = $this->createMock( \IContextSource::class );
		$context->method( 'getRequest' )->willReturn( new \FauxRequest( [ 'action' => 'edit' ] ) );
		$context->method( 'canUseWikiPage' )->willReturn( true );
		$context->method( 'getWikiPage' )->willReturn( $wikiPage );
		$context->method( 'getTitle' )->willReturn( $wikiPage->getTitle() );

		$user = $this->createMock( \User::class );
		$user->method( 'getOption' )->willReturn( true );

		$out = $this->createMock( \OutputPage::class );
		$out->method( 'getModules' )->willReturn( [] );
		$out->method( 'getContext' )->willReturn( $context );
		$out->method( 'getUser' )->willReturn( $user );
		$out->expects( $this->exactly( 2 ) )->method( 'addModules' );

		CodeMirrorHooks::onBeforePageDisplay( $out, $this->createMock( \Skin::class ) );
	}

	/**
	 * @covers \CodeMirrorHooks::onGetPreferences
	 */
	public function testPreferenceRegistered() {
		$user = self::getTestUser()->getUser();
		$this->setMwGlobals( 'wgTitle', \Title::newFromText( __METHOD__ ) );
		$kinds = MediaWikiServices::getInstance()->getUserOptionsManager()
			->getOptionKinds( $user, RequestContext::getMain(), [ 'usecodemirror' => 1 ] );
		self::assertEquals( 'registered', $kinds['usecodemirror'] );
	}
}
