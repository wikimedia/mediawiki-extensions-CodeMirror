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
use MediaWiki\Specials\SpecialUpload;
use MediaWiki\Title\Title;
use MediaWiki\User\Options\UserOptionsLookup;
use MediaWikiIntegrationTestCase;
use PHPUnit\Framework\MockObject\MockObject;

/**
 * @group CodeMirror
 * @group Database
 * @coversDefaultClass \MediaWiki\Extension\CodeMirror\Hooks
 */
class HooksTest extends MediaWikiIntegrationTestCase {

	/**
	 * @covers ::shouldLoadCodeMirror
	 * @covers ::onEditPage__showEditForm_initial
	 * @covers ::onEditPage__showReadOnlyForm_initial
	 * @param array $conds
	 * @param string[] $expectedModules
	 * @dataProvider provideOnEditPageShowEditFormInitial
	 */
	public function testOnEditPageShowEditFormInitial( array $conds, array $expectedModules ) {
		$conds = array_merge( [
			'module' => null,
			'gadget' => null,
			'contentModel' => CONTENT_MODEL_WIKITEXT,
			'useV6' => true,
			'isRTL' => false,
			'usecodemirror' => true,
			// WikiEditor
			'usebetatoolbar' => false,
			'method' => 'edit',
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

		$modulesLoaded = [];
		$out->method( 'addModules' )
			->willReturnCallback( static function ( $modules ) use ( &$modulesLoaded ) {
				$modulesLoaded = array_merge( $modulesLoaded, is_array( $modules ) ? $modules : [ $modules ] );
			} );

		$hooks = new Hooks( $userOptionsLookup, $this->getServiceContainer()->getMainConfig(), $gadgetRepoMock );
		if ( $conds['method'] === 'upload' ) {
			$uploadMock = $this->createMock( SpecialUpload::class );
			$uploadMock->method( 'getOutput' )->willReturn( $out );
			$hooks->onUploadForm_initial( $uploadMock );
		} else {
			$method = $conds['method'] === 'readOnly' ?
				'onEditPage__showReadOnlyForm_initial' :
				'onEditPage__showEditForm_initial';
			$hooks->{$method}( $this->createMock( EditPage::class ), $out );
		}
		$this->assertArrayEquals( $expectedModules, $modulesLoaded );
	}

	/**
	 * @return Generator
	 */
	public static function provideOnEditPageShowEditFormInitial(): Generator {
		$cm6DefaultModules = [ 'ext.CodeMirror.v6', 'ext.CodeMirror.v6.lib', 'ext.CodeMirror.v6.init' ];
		yield 'CM5, no WikiEditor' => [
			[ 'useV6' => false ],
			[]
		];
		yield 'CM5 + WikiEditor' => [
			[ 'useV6' => false, 'usebetatoolbar' => true ],
			[ 'ext.CodeMirror.WikiEditor', 'ext.CodeMirror.lib', 'ext.CodeMirror.mode.mediawiki' ]
		];
		yield 'CM5 + WikiEditor, read-only' => [
			[ 'useV6' => false, 'usebetatoolbar' => true, 'method' => 'readOnly' ],
			[]
		];
		yield 'CM5, read-only' => [
			[ 'useV6' => false, 'method' => 'readOnly' ],
			[]
		];
		yield 'CM5 + WikiEditor, RTL' => [
			[ 'useV6' => false, 'usebetatoolbar' => true, 'isRTL' => true ],
			[]
		];
		yield 'CM5 + WikiEditor, contentModel CSS' => [
			[ 'useV6' => false, 'usebetatoolbar' => true, 'contentModel' => CONTENT_MODEL_CSS ],
			[]
		];
		yield 'CM5 + WikiEditor, preference false' => [
			[ 'useV6' => false, 'usebetatoolbar' => true, 'usecodemirror' => false ],
			[ 'ext.CodeMirror.WikiEditor' ]
		];
		yield 'CM5 + WikiEditor, wikEd enabled' => [
			[ 'useV6' => false, 'usebetatoolbar' => true, 'gadget' => 'wikEd' ],
			[]
		];
		yield 'CM5, Special:Upload' => [
			[ 'useV6' => false, 'method' => 'upload' ],
			[]
		];
		yield 'CM6' => [
			[],
			[ ...$cm6DefaultModules, 'ext.CodeMirror.v6.mode.mediawiki' ]
		];
		yield 'CM6, read-only' => [
			[ 'method' => 'readOnly' ],
			[ ...$cm6DefaultModules, 'ext.CodeMirror.v6.mode.mediawiki' ]
		];
		yield 'CM6 + WikiEditor' => [
			[ 'usebetatoolbar' => true ],
			[ ...$cm6DefaultModules, 'ext.CodeMirror.v6.mode.mediawiki', 'ext.CodeMirror.v6.WikiEditor' ]
		];
		yield 'CM6 + WikiEditor, read-only' => [
			[ 'usebetatoolbar' => true, 'method' => 'readOnly' ],
			[ ...$cm6DefaultModules, 'ext.CodeMirror.v6.mode.mediawiki', 'ext.CodeMirror.v6.WikiEditor' ]
		];
		yield 'CM6, RTL' => [
			[ 'isRTL' => true ],
			[ ...$cm6DefaultModules, 'ext.CodeMirror.v6.mode.mediawiki' ]
		];
		yield 'CM6, contentModel CSS' => [
			[ 'contentModel' => CONTENT_MODEL_CSS ],
			[]
		];
		yield 'CM6, contentModel CSS, CodeEditor' => [
			[ 'contentModel' => CONTENT_MODEL_CSS, 'module' => 'ext.codeEditor' ],
			[]
		];
		yield 'CM6, preference false' => [
			[ 'usecodemirror' => false ],
			[]
		];
		yield 'CM6 + WikiEditor, WikEd enabled' => [
			[ 'usebetatoolbar' => true, 'gadget' => 'wikEd' ],
			[]
		];
		yield 'CM6, preference false, WikiEditor' => [
			[ 'usebetatoolbar' => true, 'usecodemirror' => false ],
			[ 'ext.CodeMirror.v6.init' ]
		];
		yield 'CM6, Special:Upload' => [
			[ 'method' => 'upload' ],
			[ ...$cm6DefaultModules, 'ext.CodeMirror.v6.mode.mediawiki' ]
		];
		yield 'CM6 + WikiEditor, Special:Upload' => [
			[ 'usebetatoolbar' => true, 'method' => 'upload' ],
			[ ...$cm6DefaultModules, 'ext.CodeMirror.v6.mode.mediawiki' ]
		];
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
	 * @param string $contentModel
	 * @param bool $isRTL
	 * @return OutputPage&MockObject
	 */
	private function getMockOutputPage( string $contentModel = CONTENT_MODEL_WIKITEXT, bool $isRTL = false ) {
		$out = $this->createMock( OutputPage::class );
		$out->method( 'getUser' )->willReturn( $this->getTestUser()->getUser() );
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
