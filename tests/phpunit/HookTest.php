<?php

namespace MediaWiki\Extension\CodeMirror\Tests;

use ExtensionRegistry;
use MediaWiki\Extension\CodeMirror\Hooks;
use MediaWiki\Extension\Gadgets\Gadget;
use MediaWiki\Extension\Gadgets\GadgetRepo;
use MediaWiki\Output\OutputPage;
use MediaWiki\Request\WebRequest;
use MediaWiki\Title\Title;
use MediaWiki\User\Options\UserOptionsLookup;
use MediaWiki\User\User;
use MediaWikiIntegrationTestCase;
use PHPUnit\Framework\MockObject\MockObject;
use RequestContext;
use Skin;

/**
 * @group CodeMirror
 * @group Database
 * @coversDefaultClass \MediaWiki\Extension\CodeMirror\Hooks
 */
class HookTest extends MediaWikiIntegrationTestCase {

	/**
	 * @covers ::shouldLoadCodeMirror
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

		$out = $this->getMockOutputPage();
		$out->method( 'getModules' )->willReturn( [] );
		$out->expects( $this->exactly( $expectedAddModuleCalls ) )
			->method( 'addModules' )
			->withConsecutive( [ $this->equalTo( $expectedFirstModule ) ] );

		( new Hooks( $userOptionsLookup, $this->getServiceContainer()->getMainConfig() ) )
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

	/**
	 * @covers ::shouldLoadCodeMirror
	 * @dataProvider provideShouldLoadCodeMirror
	 */
	public function testShouldLoadCodeMirror( ?string $module, ?string $gadget, bool $expectation ): void {
		$out = $this->getMockOutputPage();
		$out->method( 'getModules' )->willReturn( $module ? [ $module ] : [] );
		$userOptionsLookup = $this->createMock( UserOptionsLookup::class );
		$userOptionsLookup->method( 'getOption' )->willReturn( true );
		$this->setService( 'UserOptionsLookup', $userOptionsLookup );

		if ( $gadget && !ExtensionRegistry::getInstance()->isLoaded( 'Gadgets' ) ) {
			$this->markTestSkipped( 'Skipped as Gadgets extension is not available' );
		}

		$extensionRegistry = $this->getMockExtensionRegistry( (bool)$gadget );

		if ( $gadget ) {
			$gadgetMock = $this->createMock( Gadget::class );
			$gadgetMock->expects( $this->once() )
				->method( 'isEnabled' )
				->willReturn( true );
			$gadgetRepoMock = $this->createMock( GadgetRepo::class );
			$gadgetRepoMock->expects( $this->once() )
				->method( 'getGadget' )
				->willReturn( $gadgetMock );
			$gadgetRepoMock->expects( $this->once() )
				->method( 'getGadgetIds' )
				->willReturn( [ $gadget ] );
			GadgetRepo::setSingleton( $gadgetRepoMock );
		}

		$hooks = new Hooks(
			$userOptionsLookup,
			$this->getServiceContainer()->getMainConfig()
		);
		self::assertSame( $expectation, $hooks->shouldLoadCodeMirror( $out, $extensionRegistry ) );
	}

	/**
	 * @return array[]
	 */
	public function provideShouldLoadCodeMirror(): array {
		return [
			[ null, null, true ],
			[ 'ext.codeEditor', null, false ],
			[ null, 'wikEd', false ]
		];
	}

	/**
	 * @return OutputPage|MockObject
	 */
	private function getMockOutputPage() {
		$out = $this->createMock( OutputPage::class );
		$out->method( 'getUser' )->willReturn( $this->createMock( User::class ) );
		$out->method( 'getActionName' )->willReturn( 'edit' );
		$out->method( 'getTitle' )->willReturn( Title::makeTitle( NS_MAIN, __METHOD__ ) );
		$request = $this->createMock( WebRequest::class );
		$request->method( 'getRawVal' )->willReturn( null );
		$out->method( 'getRequest' )->willReturn( $request );
		return $out;
	}

	/**
	 * @param bool $gadgetsEnabled
	 * @return MockObject|ExtensionRegistry
	 */
	private function getMockExtensionRegistry( bool $gadgetsEnabled ) {
		$mock = $this->createMock( ExtensionRegistry::class );
		$mock->method( 'isLoaded' )
			->with( 'Gadgets' )
			->willReturn( $gadgetsEnabled );
		return $mock;
	}
}
