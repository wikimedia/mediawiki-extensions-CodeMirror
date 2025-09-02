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
use MediaWiki\Request\WebRequest;
use MediaWiki\Specials\SpecialExpandTemplates;
use MediaWiki\Specials\SpecialUpload;
use MediaWiki\Title\Title;
use MediaWiki\User\Options\UserOptionsLookup;
use MediaWikiIntegrationTestCase;
use PHPUnit\Framework\MockObject\MockObject;

/**
 * @group CodeMirror
 * @group Database
 * @covers \MediaWiki\Extension\CodeMirror\Hooks
 */
class HooksTest extends MediaWikiIntegrationTestCase {

	/**
	 * @param array $conds
	 * @param string[] $expectedModules
	 * @param string $expectedMode
	 * @dataProvider provideOnEditPageShowEditFormInitial
	 */
	public function testOnEditPageShowEditFormInitial(
		array $conds,
		array $expectedModules,
		string $expectedMode = 'mediawiki'
	) {
		$conds = array_merge( [
			'module' => null,
			'gadget' => null,
			'contentModel' => CONTENT_MODEL_WIKITEXT,
			'useV6' => true,
			'usecodemirror' => true,
			'isRTL' => false,
			// WikiEditor
			'usebetatoolbar' => false,
			'method' => 'edit',
			'reupload' => false,
			'pageLang' => 'en',
		], $conds );
		$this->overrideConfigValues( [
			'CodeMirrorV6' => $conds['useV6'],
			'CodeMirrorEnabledModes' => $conds['allowedModes'] ?? [
				Hooks::MODE_MEDIAWIKI => true,
			],
		] );

		$out = $this->getMockOutputPage( $conds['contentModel'], $conds['isRTL'], $conds['pageLang'] );
		$out->method( 'getModules' )->willReturn( $conds['module'] ? [ $conds['module'] ] : [] );
		$userOptionsLookup = $this->createMock( UserOptionsLookup::class );
		$userOptionsLookup->method( 'getBoolOption' )
			->willReturnMap( [
				[ $out->getUser(), 'usecodemirror', 0, $conds['usecodemirror'] ],
				[ $out->getUser(), 'usebetatoolbar', 0, $conds['usebetatoolbar'] ]
			] );
		$langFactory = $this->getServiceContainer()->getLanguageFactory();

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
		$jsConfigVars = [];
		$out->method( 'addModules' )
			->willReturnCallback( static function ( $modules ) use ( &$modulesLoaded ) {
				$modulesLoaded = array_merge( $modulesLoaded, is_array( $modules ) ? $modules : [ $modules ] );
			} );
		$out->method( 'addJsConfigVars' )
			->willReturnCallback( static function ( $vars ) use ( &$jsConfigVars ) {
				$jsConfigVars = array_merge( $jsConfigVars, $vars );
			} );

		$hooks = new Hooks(
			$this->getServiceContainer()->getMainConfig(),
			$this->getServiceContainer()->getHookContainer(),
			$this->getServiceContainer()->getLanguageConverterFactory(),
			$userOptionsLookup,
			$gadgetRepoMock
		);
		if ( $conds['method'] === 'upload' ) {
			$uploadMock = $this->createMock( SpecialUpload::class );
			$uploadMock->method( 'getOutput' )->willReturn( $out );
			$uploadMock->mForReUpload = $conds['reupload'];
			$hooks->onUploadForm_initial( $uploadMock );
		} elseif ( $conds['method'] === 'expandTemplates' ) {
			$expandTemplatesMock = $this->createMock( SpecialExpandTemplates::class );
			$expandTemplatesMock->method( 'getName' )->willReturn( 'ExpandTemplates' );
			$expandTemplatesMock->method( 'getOutput' )->willReturn( $out );
			$hooks->onSpecialPageBeforeExecute( $expandTemplatesMock, '' );
			$this->assertEquals( '[name=wpInput]', $jsConfigVars['cmTextarea'] );
			$this->assertArrayEquals( [ '#output' ], $jsConfigVars['cmChildTextareas'] );
		} else {
			$method = $conds['method'] === 'readOnly' ?
				'onEditPage__showReadOnlyForm_initial' :
				'onEditPage__showEditForm_initial';
			$hooks->{$method}( $this->createMock( EditPage::class ), $out );
		}
		$this->assertArrayEquals( $expectedModules, $modulesLoaded );
		if ( $conds['useV6'] ) {
			$this->assertEquals( $expectedMode, $jsConfigVars['cmMode'] ?? 'mediawiki' );
		}
		if ( $conds['useV6'] && $conds['pageLang'] !== 'en' ) {
			$langConverterFactory = $this->getServiceContainer()->getLanguageConverterFactory();
			$pageLang = $langFactory->getLanguage( $conds['pageLang'] );
			$variants = $langConverterFactory->getLanguageConverter( $pageLang )->getVariants();
			$this->assertArrayEquals( $variants, $jsConfigVars['cmLanguageVariants'] );
			$this->assertEquals( '#wpTextbox1', $jsConfigVars['cmTextarea'] );
		}
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
			[ 'useV6' => false, 'usebetatoolbar' => true, 'isRTL' => true, 'pageLang' => 'ar' ],
			[]
		];
		yield 'CM5 + WikiEditor, contentModel CSS' => [
			[ 'useV6' => false, 'usebetatoolbar' => true, 'contentModel' => CONTENT_MODEL_CSS ],
			[]
		];
		yield 'CM5 + WikiEditor, contentModel CSS, CSS allowed' => [
			[
				'useV6' => false,
				'usebetatoolbar' => true,
				'contentModel' => CONTENT_MODEL_CSS,
				'allowedModes' => [ Hooks::MODE_CSS => true ]
			],
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
			[ 'isRTL' => true, 'lang' => 'ar' ],
			[ ...$cm6DefaultModules, 'ext.CodeMirror.v6.mode.mediawiki' ]
		];
		yield 'CM6, contentModel CSS' => [
			[ 'contentModel' => CONTENT_MODEL_CSS, 'allowedModes' => [ Hooks::MODE_CSS => true ] ],
			[ ...$cm6DefaultModules, 'ext.CodeMirror.v6.mode.css' ],
			'css'
		];
		yield 'CM6, contentModel JavaScript' => [
			[
				'contentModel' => CONTENT_MODEL_JAVASCRIPT,
				'allowedModes' => [ CONTENT_MODEL_JAVASCRIPT => true ]
			],
			[ ...$cm6DefaultModules, 'ext.CodeMirror.v6.mode.javascript' ],
			'javascript'
		];
		yield 'CM6, contentModel JSON' => [
			[ 'contentModel' => CONTENT_MODEL_JSON, 'allowedModes' => [ Hooks::MODE_JSON => true ] ],
			[ ...$cm6DefaultModules, 'ext.CodeMirror.v6.mode.json' ],
			'json'
		];
		yield 'CM6, contentModel CSS, CSS not allowed' => [
			[ 'contentModel' => CONTENT_MODEL_CSS, 'allowedModes' => [ Hooks::MODE_CSS => false ] ],
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
		yield 'CM6, Special:Upload, reupload' => [
			[ 'method' => 'upload', 'reupload' => true ],
			[]
		];
		yield 'CM6 + WikiEditor, Special:Upload' => [
			[ 'usebetatoolbar' => true, 'method' => 'upload' ],
			[ ...$cm6DefaultModules, 'ext.CodeMirror.v6.mode.mediawiki' ]
		];
		yield 'CM6, page language zh' => [
			[ 'pageLang' => 'zh' ],
			[ ...$cm6DefaultModules, 'ext.CodeMirror.v6.mode.mediawiki' ]
		];
		yield 'CM6, Special:ExpandTemplates' => [
			[ 'method' => 'expandTemplates' ],
			[ ...$cm6DefaultModules, 'ext.CodeMirror.v6.mode.mediawiki' ]
		];
	}

	public function testPreferenceRegistered() {
		$user = self::getTestUser()->getUser();
		$context = RequestContext::getMain();
		$context->setTitle( Title::newFromText( __METHOD__ ) );
		$kinds = $this->getServiceContainer()->getPreferencesFactory()
			->getResetKinds( $user, $context, [ 'usecodemirror' => 1 ] );
		self::assertEquals( 'registered', $kinds['usecodemirror'] );
	}

	public function testOnGetPreferencces(): void {
		$user = self::getTestUser()->getUser();
		$userOptionsLookup = $this->getServiceContainer()->getUserOptionsLookup();
		$hookContainer = $this->getServiceContainer()->getHookContainer();
		$langConverterFactory = $this->getServiceContainer()->getLanguageConverterFactory();
		$config = $this->getServiceContainer()->getMainConfig();

		// CodeMirror 5
		$this->overrideConfigValues( [ 'CodeMirrorV6' => false ] );
		$hook = new Hooks( $config, $hookContainer, $langConverterFactory, $userOptionsLookup, null );
		$preferences = [];
		$hook->onGetPreferences( $user, $preferences );
		self::assertArrayHasKey( 'usecodemirror', $preferences );
		self::assertArrayHasKey( 'usecodemirror-colorblind', $preferences );
		self::assertArrayNotHasKey( 'usecodemirror-summary', $preferences );
		self::assertSame( 'api', $preferences['usecodemirror']['type'] );

		// CodeMirror 6
		$this->overrideConfigValues( [ 'CodeMirrorV6' => true ] );
		$hook = new Hooks( $config, $hookContainer, $langConverterFactory, $userOptionsLookup, null );
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
	 * @param string $lang
	 * @return OutputPage&MockObject
	 */
	private function getMockOutputPage(
		string $contentModel = CONTENT_MODEL_WIKITEXT,
		bool $isRTL = false,
		string $lang = 'en'
	) {
		$out = $this->createMock( OutputPage::class );
		$out->method( 'getUser' )->willReturn( $this->getTestUser()->getUser() );
		$out->method( 'getActionName' )->willReturn( 'edit' );
		$language = $this->createMock( Language::class );
		$language->method( 'isRTL' )->willReturn( $isRTL );
		$langFactory = $this->getServiceContainer()->getLanguageFactory();
		$title = $this->createMock( Title::class );
		$title->method( 'getContentModel' )->willReturn( $contentModel );
		$title->method( 'getPageLanguage' )->willReturn( $langFactory->getLanguage( $lang ) );
		$out->method( 'getTitle' )->willReturn( $title );
		$request = $this->createMock( WebRequest::class );
		$request->method( 'getRawVal' )->willReturn( null );
		$out->method( 'getRequest' )->willReturn( $request );
		return $out;
	}
}
