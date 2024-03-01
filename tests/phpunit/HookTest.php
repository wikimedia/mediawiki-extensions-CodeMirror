<?php

namespace MediaWiki\Extension\CodeMirror\Tests;

use ExtensionRegistry;
use Generator;
use Language;
use MediaWiki\Context\RequestContext;
use MediaWiki\EditPage\EditPage;
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

/**
 * @group CodeMirror
 * @group Database
 * @coversDefaultClass \MediaWiki\Extension\CodeMirror\Hooks
 */
class HookTest extends MediaWikiIntegrationTestCase {

	/**
	 * @covers ::shouldLoadCodeMirror
	 * @covers ::onEditPage__showEditForm_initial
	 * @param bool $useCodeMirrorV6
	 * @param int $expectedAddModuleCalls
	 * @param string|null $expectedFirstModule
	 * @dataProvider provideOnEditPageShowEditFormInitial
	 */
	public function testOnEditPageShowEditFormInitial(
		bool $useCodeMirrorV6, int $expectedAddModuleCalls, ?string $expectedFirstModule
	) {
		$this->overrideConfigValues( [
			'CodeMirrorV6' => $useCodeMirrorV6,
		] );
		$userOptionsLookup = $this->createMock( UserOptionsLookup::class );
		$userOptionsLookup->method( 'getOption' )->willReturn( true );

		$out = $this->getMockOutputPage();
		$out->method( 'getModules' )->willReturn( [] );
		$isFirstCall = true;
		$out->expects( $this->exactly( $expectedAddModuleCalls ) )
			->method( 'addModules' )
			->willReturnCallback( function ( $modules ) use ( $expectedFirstModule, &$isFirstCall ) {
				if ( $isFirstCall && $modules !== null ) {
					$this->assertSame( $expectedFirstModule, $modules );
				}
				$isFirstCall = false;
			} );

		$hooks = new Hooks( $userOptionsLookup, $this->getServiceContainer()->getMainConfig() );
		$hooks->onEditPage__showEditForm_initial( $this->createMock( EditPage::class ), $out );
	}

	/**
	 * @return Generator
	 */
	public static function provideOnEditPageShowEditFormInitial(): Generator {
		// useCodeMirrorV6, expectedAddModuleCalls, expectedFirstModule
		yield 'CM5' => [ false, 2, 'ext.CodeMirror.WikiEditor' ];
		yield 'CM6' => [ true, 1, 'ext.CodeMirror.v6.WikiEditor' ];
	}

	/**
	 * @covers ::onGetPreferences
	 */
	public function testPreferenceRegistered() {
		$user = self::getTestUser()->getUser();
		$context = RequestContext::getMain();
		$context->setTitle( Title::newFromText( __METHOD__ ) );
		$kinds = $this->getServiceContainer()->getUserOptionsManager()
			->getOptionKinds( $user, $context, [ 'usecodemirror' => 1 ] );
		self::assertEquals( 'registered', $kinds['usecodemirror'] );
	}

	/**
	 * @covers ::shouldLoadCodeMirror
	 * @dataProvider provideShouldLoadCodeMirror
	 * @param string|null $module
	 * @param string|null $gadget
	 * @param bool $expectation
	 * @param string $contentModel
	 * @param bool $useCodeMirrorV6
	 * @param bool $isRTL
	 */
	public function testShouldLoadCodeMirror(
		?string $module,
		?string $gadget,
		bool $expectation,
		string $contentModel = CONTENT_MODEL_WIKITEXT,
		bool $useCodeMirrorV6 = false,
		bool $isRTL = false
	): void {
		$this->overrideConfigValues( [
			'CodeMirrorV6' => $useCodeMirrorV6,
		] );
		$out = $this->getMockOutputPage( $contentModel, $isRTL );
		$out->method( 'getModules' )->willReturn( $module ? [ $module ] : [] );
		$userOptionsLookup = $this->createMock( UserOptionsLookup::class );
		$userOptionsLookup->method( 'getOption' )->willReturn( true );

		if ( $gadget && !ExtensionRegistry::getInstance()->isLoaded( 'Gadgets' ) ) {
			$this->markTestSkipped( 'Skipped as Gadgets extension is not available' );
		}

		$extensionRegistry = $this->getMockExtensionRegistry( (bool)$gadget );
		$extensionRegistry->method( 'getAttribute' )
			->with( 'CodeMirrorContentModels' )
			->willReturn( [ CONTENT_MODEL_WIKITEXT ] );

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
	 * @return Generator
	 */
	public function provideShouldLoadCodeMirror(): Generator {
		// module, gadget, expectation, contentModel, shouldUseV6, isRTL
		yield 'no modules, no gadgets, wikitext' => [ null, null, true ];
		yield 'codeEditor, no gadgets, wikitext' => [ 'ext.codeEditor', null, false ];
		yield 'no modules, wikEd, wikitext' => [ null, 'wikEd', false ];
		yield 'no modules, no gadgets, CSS' => [ null, null, false, CONTENT_MODEL_CSS ];
		yield 'CM5 wikitext RTL' => [ null, null, false, CONTENT_MODEL_WIKITEXT, false, true ];
		yield 'CM6 wikitext RTL' => [ null, null, true, CONTENT_MODEL_WIKITEXT, true, true ];
	}

	/**
	 * @param string $contentModel
	 * @param bool $isRTL
	 * @return OutputPage|MockObject
	 */
	private function getMockOutputPage( string $contentModel = CONTENT_MODEL_WIKITEXT, bool $isRTL = false ) {
		$out = $this->createMock( OutputPage::class );
		$out->method( 'getUser' )->willReturn( $this->createMock( User::class ) );
		$out->method( 'getActionName' )->willReturn( 'edit' );
		$title = $this->createMock( Title::class );
		$title->method( 'getContentModel' )->willReturn( $contentModel );
		$language = $this->createMock( Language::class );
		$language->method( 'isRTL' )->willReturn( $isRTL );
		$title->method( 'getPageLanguage' )->willReturn( $language );
		$out->method( 'getTitle' )->willReturn( $title );
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
