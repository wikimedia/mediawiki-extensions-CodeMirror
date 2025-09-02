<?php

namespace MediaWiki\Extension\CodeMirror\Tests;

use Generator;
use MediaWiki\Context\RequestContext;
use MediaWiki\EditPage\EditPage;
use MediaWiki\Extension\CodeMirror\Hooks;
use MediaWiki\Extension\Gadgets\Gadget;
use MediaWiki\Extension\Gadgets\GadgetRepo;
use MediaWiki\HTMLForm\HTMLForm;
use MediaWiki\Language\Language;
use MediaWiki\Output\OutputPage;
use MediaWiki\Request\WebRequest;
use MediaWiki\Specials\SpecialExpandTemplates;
use MediaWiki\Specials\SpecialUpload;
use MediaWiki\Title\Title;
use MediaWiki\User\Options\UserOptionsManager;
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
			Hooks::OPTION_USE_CODEMIRROR => true,
			'isRTL' => false,
			Hooks::OPTION_USE_WIKIEDITOR => false,
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
		$userOptionsManager = $this->createMock( UserOptionsManager::class );
		$userOptionsManager->method( 'getBoolOption' )
			->willReturnMap( [
				[ $out->getUser(), Hooks::OPTION_USE_CODEMIRROR, 0, $conds[Hooks::OPTION_USE_CODEMIRROR] ],
				[ $out->getUser(), Hooks::OPTION_USE_WIKIEDITOR, 0, $conds[Hooks::OPTION_USE_WIKIEDITOR] ]
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
			$userOptionsManager,
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
			[ 'useV6' => false, Hooks::OPTION_USE_WIKIEDITOR => true ],
			[ 'ext.CodeMirror.WikiEditor', 'ext.CodeMirror.lib', 'ext.CodeMirror.mode.mediawiki' ]
		];
		yield 'CM5 + WikiEditor, read-only' => [
			[ 'useV6' => false, Hooks::OPTION_USE_WIKIEDITOR => true, 'method' => 'readOnly' ],
			[]
		];
		yield 'CM5, read-only' => [
			[ 'useV6' => false, 'method' => 'readOnly' ],
			[]
		];
		yield 'CM5 + WikiEditor, RTL' => [
			[ 'useV6' => false, Hooks::OPTION_USE_WIKIEDITOR => true, 'isRTL' => true, 'pageLang' => 'ar' ],
			[]
		];
		yield 'CM5 + WikiEditor, contentModel CSS' => [
			[ 'useV6' => false, Hooks::OPTION_USE_WIKIEDITOR => true, 'contentModel' => CONTENT_MODEL_CSS ],
			[]
		];
		yield 'CM5 + WikiEditor, contentModel CSS, CSS allowed' => [
			[
				'useV6' => false,
				Hooks::OPTION_USE_WIKIEDITOR => true,
				'contentModel' => CONTENT_MODEL_CSS,
				'allowedModes' => [ Hooks::MODE_CSS => true ]
			],
			[]
		];
		yield 'CM5 + WikiEditor, preference false' => [
			[ 'useV6' => false, Hooks::OPTION_USE_WIKIEDITOR => true, Hooks::OPTION_USE_CODEMIRROR => false ],
			[ 'ext.CodeMirror.WikiEditor' ]
		];
		yield 'CM5 + WikiEditor, wikEd enabled' => [
			[ 'useV6' => false, Hooks::OPTION_USE_WIKIEDITOR => true, 'gadget' => 'wikEd' ],
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
			[ Hooks::OPTION_USE_WIKIEDITOR => true ],
			[ ...$cm6DefaultModules, 'ext.CodeMirror.v6.mode.mediawiki', 'ext.CodeMirror.v6.WikiEditor' ]
		];
		yield 'CM6 + WikiEditor, read-only' => [
			[ Hooks::OPTION_USE_WIKIEDITOR => true, 'method' => 'readOnly' ],
			[ ...$cm6DefaultModules, 'ext.CodeMirror.v6.mode.mediawiki', 'ext.CodeMirror.v6.WikiEditor' ]
		];
		yield 'CM6, RTL' => [
			[ 'isRTL' => true, 'lang' => 'ar' ],
			[ ...$cm6DefaultModules, 'ext.CodeMirror.v6.mode.mediawiki' ]
		];
		yield 'CM6, contentModel CSS' => [
			[ 'contentModel' => CONTENT_MODEL_CSS, 'allowedModes' => [ Hooks::MODE_CSS => true ] ],
			[ ...$cm6DefaultModules, 'ext.CodeMirror.v6.modes' ],
			'css'
		];
		yield 'CM6, contentModel JavaScript' => [
			[
				'contentModel' => CONTENT_MODEL_JAVASCRIPT,
				'allowedModes' => [ CONTENT_MODEL_JAVASCRIPT => true ]
			],
			[ ...$cm6DefaultModules, 'ext.CodeMirror.v6.modes' ],
			'javascript'
		];
		yield 'CM6, contentModel JSON' => [
			[ 'contentModel' => CONTENT_MODEL_JSON, 'allowedModes' => [ Hooks::MODE_JSON => true ] ],
			[ ...$cm6DefaultModules, 'ext.CodeMirror.v6.modes' ],
			'json'
		];
		yield 'CM6, contentModel CSS, CSS not allowed' => [
			[ 'contentModel' => CONTENT_MODEL_CSS, 'allowedModes' => [ Hooks::MODE_CSS => false ] ],
			[]
		];
		yield 'CM6, preference false' => [
			[ Hooks::OPTION_USE_CODEMIRROR => false ],
			[]
		];
		yield 'CM6 + WikiEditor, WikEd enabled' => [
			[ Hooks::OPTION_USE_WIKIEDITOR => true, 'gadget' => 'wikEd' ],
			[]
		];
		yield 'CM6, preference false, WikiEditor' => [
			[ Hooks::OPTION_USE_WIKIEDITOR => true, Hooks::OPTION_USE_CODEMIRROR => false ],
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
			[ Hooks::OPTION_USE_WIKIEDITOR => true, 'method' => 'upload' ],
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
			->getResetKinds( $user, $context, [ Hooks::OPTION_USE_CODEMIRROR => 1 ] );
		self::assertEquals( 'registered', $kinds[Hooks::OPTION_USE_CODEMIRROR] );
	}

	public function testOnGetPreferences(): void {
		$user = self::getTestUser()->getUser();
		$config = $this->getServiceContainer()->getMainConfig();
		$hookContainer = $this->getServiceContainer()->getHookContainer();
		$langConverterFactory = $this->getServiceContainer()->getLanguageConverterFactory();
		$userOptionsManager = $this->getServiceContainer()->getUserOptionsManager();

		// CodeMirror 5
		$this->overrideConfigValues( [ 'CodeMirrorV6' => false ] );
		$hooks = new Hooks( $config, $hookContainer, $langConverterFactory, $userOptionsManager, null );
		$preferences = [];
		$hooks->onGetPreferences( $user, $preferences );
		self::assertArrayHasKey( Hooks::OPTION_USE_CODEMIRROR, $preferences );
		self::assertArrayHasKey( Hooks::OPTION_COLORBLIND, $preferences );
		self::assertArrayNotHasKey( 'usecodemirror-summary', $preferences );
		self::assertSame( 'api', $preferences[Hooks::OPTION_USE_CODEMIRROR]['type'] );

		// CodeMirror 6
		$this->overrideConfigValues( [ 'CodeMirrorV6' => true ] );
		$hooks = new Hooks( $config, $hookContainer, $langConverterFactory, $userOptionsManager, null );
		$preferences = [];
		$hooks->onGetPreferences( $user, $preferences );
		self::assertArrayHasKey( Hooks::OPTION_USE_CODEMIRROR, $preferences );
		self::assertArrayHasKey( Hooks::OPTION_COLORBLIND, $preferences );
		self::assertArrayHasKey( 'usecodemirror-summary', $preferences );
		self::assertSame( 'toggle', $preferences[Hooks::OPTION_USE_CODEMIRROR]['type'] );
	}

	public function testOnPreferencesFormPreSave(): void {
		$user = self::getTestUser()->getUser();
		$config = $this->getServiceContainer()->getMainConfig();
		$hookContainer = $this->getServiceContainer()->getHookContainer();
		$langConverterFactory = $this->getServiceContainer()->getLanguageConverterFactory();
		$userOptionsManager = $this->getMockBuilder( UserOptionsManager::class )
			->disableOriginalConstructor()
			->onlyMethods( [ 'setOption' ] )
			->getMock();
		$userOptionsManager->expects( $this->once() )
			->method( 'setOption' )
			->with( $user, Hooks::OPTION_USE_CODEMIRROR, 1 );
		$hooks = new Hooks( $config, $hookContainer, $langConverterFactory, $userOptionsManager, null );
		$result = true;
		$hooks->onPreferencesFormPreSave(
			[ Hooks::OPTION_BETA_FEATURE => '1' ],
			$this->getMockBuilder( HTMLForm::class )
				->disableOriginalConstructor()
				->getMock(),
			$user,
			$result,
			[ Hooks::OPTION_USE_CODEMIRROR => '' ]
		);
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
	): OutputPage&MockObject {
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
