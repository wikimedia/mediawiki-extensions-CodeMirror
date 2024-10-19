<?php

namespace MediaWiki\Extension\CodeMirror\Tests;

use Generator;
use MediaWiki\Context\RequestContext;
use MediaWiki\EditPage\EditPage;
use MediaWiki\Extension\CodeMirror\Hooks;
use MediaWiki\Extension\Gadgets\Gadget;
use MediaWiki\Extension\Gadgets\GadgetRepo;
use MediaWiki\Language\Language;
use MediaWiki\Output\OutputPage;
use MediaWiki\Registration\ExtensionRegistry;
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
	 * @covers ::onEditPage__showReadOnlyForm_initial
	 * @param bool $useCodeMirrorV6
	 * @param int $expectedAddModuleCalls
	 * @param string|null $expectedFirstModule
	 * @param bool $readOnly
	 * @dataProvider provideOnEditPageShowEditFormInitial
	 */
	public function testOnEditPageShowEditFormInitial(
		bool $useCodeMirrorV6,
		int $expectedAddModuleCalls,
		?string $expectedFirstModule,
		bool $readOnly = false
	) {
		$this->overrideConfigValues( [
			'CodeMirrorV6' => $useCodeMirrorV6,
		] );
		$userOptionsLookup = $this->createMock( UserOptionsLookup::class );
		$userOptionsLookup->method( 'getBoolOption' )->willReturn( true );

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

		$hooks = new Hooks( $userOptionsLookup, $this->getServiceContainer()->getMainConfig(), null );
		$method = $readOnly ? 'onEditPage__showReadOnlyForm_initial' : 'onEditPage__showEditForm_initial';
		$hooks->{$method}( $this->createMock( EditPage::class ), $out );
	}

	/**
	 * @return Generator
	 */
	public static function provideOnEditPageShowEditFormInitial(): Generator {
		// useCodeMirrorV6, expectedAddModuleCalls, expectedFirstModule, readOnly
		yield 'CM5' => [ false, 2, 'ext.CodeMirror.WikiEditor' ];
		yield 'CM6' => [ true, 1, 'ext.CodeMirror.v6.WikiEditor.init' ];
		yield 'CM5 read-only' => [ false, 0, null, true ];
		yield 'CM6 read-only' => [ true, 1, 'ext.CodeMirror.v6.WikiEditor.init', true ];
	}

	/**
	 * @covers ::onGetPreferences
	 */
	public function testPreferenceRegistered() {
		$user = self::getTestUser()->getUser();
		$context = RequestContext::getMain();
		$context->setTitle( Title::newFromText( __METHOD__ ) );
		$kinds = $this->getServiceContainer()->getPreferencesFactory()
			->getResetKinds( $user, $context, [ 'usecodemirror' => 1 ] );
		self::assertEquals( 'registered', $kinds['usecodemirror'] );
	}

	/**
	 * @covers ::onGetPreferences
	 */
	public function testOnGetPreferencces(): void {
		$user = self::getTestUser()->getUser();
		$userOptionsLookup = $this->getServiceContainer()->getUserOptionsLookup();
		$config = $this->getServiceContainer()->getMainConfig();

		// CodeMirror 5
		$this->overrideConfigValues( [ 'CodeMirrorV6' => false ] );
		$hook = new Hooks( $userOptionsLookup, $config, null );
		$preferences = [];
		$hook->onGetPreferences( $user, $preferences );
		self::assertArrayHasKey( 'usecodemirror', $preferences );
		self::assertArrayHasKey( 'usecodemirror-colorblind', $preferences );
		self::assertArrayNotHasKey( 'usecodemirror-summary', $preferences );
		self::assertSame( 'api', $preferences['usecodemirror']['type'] );

		// CodeMirror 6
		$this->overrideConfigValues( [ 'CodeMirrorV6' => true ] );
		$hook = new Hooks( $userOptionsLookup, $config, null );
		$preferences = [];
		$hook->onGetPreferences( $user, $preferences );
		self::assertArrayHasKey( 'usecodemirror', $preferences );
		self::assertArrayHasKey( 'usecodemirror-colorblind', $preferences );
		self::assertArrayHasKey( 'usecodemirror-summary', $preferences );
		self::assertSame( 'toggle', $preferences['usecodemirror']['type'] );
	}

	/**
	 * @covers ::shouldLoadCodeMirror
	 * @dataProvider provideShouldLoadCodeMirror
	 * @param array $conds
	 * @param bool $expectation
	 */
	public function testShouldLoadCodeMirror( array $conds, bool $expectation ): void {
		$conds = array_merge( [
			'module' => null,
			'gadget' => null,
			'contentModel' => CONTENT_MODEL_WIKITEXT,
			'useV6' => false,
			'isRTL' => false,
			'usecodemirror' => true,
			'usebetatoolbar' => true,
		], $conds );
		$this->overrideConfigValues( [
			'CodeMirrorV6' => $conds['useV6'],
		] );
		$out = $this->getMockOutputPage( $conds['contentModel'], $conds['isRTL'] );
		$out->method( 'getModules' )->willReturn( $conds['module'] ? [ $conds['module'] ] : [] );
		$userOptionsLookup = $this->createMock( UserOptionsLookup::class );
		$userOptionsLookup->method( 'getBoolOption' )
			->willReturnMap( [
				[ $out->getUser(), 'usecodemirror', 0, $conds['usecodemirror'] ],
				[ $out->getUser(), 'usebetatoolbar', 0, $conds['usebetatoolbar'] ]
			] );

		$extensionRegistry = $this->getMockExtensionRegistry( (bool)$conds['gadget'] );
		$extensionRegistry->method( 'getAttribute' )
			->with( 'CodeMirrorContentModels' )
			->willReturn( [ CONTENT_MODEL_WIKITEXT ] );

		$gadgetRepoMock = null;
		if ( $conds['gadget'] ) {
			$this->markTestSkippedIfExtensionNotLoaded( 'Gadgets' );

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
				->willReturn( [ $conds['gadget'] ] );
		}

		$hooks = new Hooks( $userOptionsLookup, $this->getServiceContainer()->getMainConfig(), $gadgetRepoMock );
		self::assertSame( $expectation, $hooks->shouldLoadCodeMirror( $out, $extensionRegistry ) );
	}

	/**
	 * @return Generator
	 */
	public function provideShouldLoadCodeMirror(): Generator {
		// [ conditions, expectation ]
		yield [ [], true ];
		yield [ [ 'module' => 'ext.codeEditor' ], false ];
		yield [ [ 'gadget' => 'wikEd' ], false ];
		yield [ [ 'contentModel' => CONTENT_FORMAT_CSS ], false ];
		yield [ [ 'isRTL' => true ], false ];
		yield [ [ 'isRTL' => true, 'useV6' => true ], true ];
		yield [ [ 'usebetatoolbar' => false ], false ];
		yield [ [ 'usebetatoolbar' => false, 'useV6' => true ], true ];
		yield [ [ 'usebetatoolbar' => false, 'usecodemirror' => false, 'useV6' => true ], false ];
		yield [ [ 'usecodemirror' => false ], true ];
		yield [ [ 'usecodemirror' => false, 'useV6' => true ], true ];
		yield [ [ 'usecodemirror' => false, 'usebetatoolbar' => false, 'useV6' => true ], false ];
	}

	/**
	 * @param string $contentModel
	 * @param bool $isRTL
	 * @return OutputPage&MockObject
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
	 * @return ExtensionRegistry&MockObject
	 */
	private function getMockExtensionRegistry( bool $gadgetsEnabled ) {
		$mock = $this->createMock( ExtensionRegistry::class );
		$mock->method( 'isLoaded' )
			->with( 'Gadgets' )
			->willReturn( $gadgetsEnabled );
		return $mock;
	}
}
