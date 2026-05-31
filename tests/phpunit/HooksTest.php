<?php
declare( strict_types = 1 );

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
			'contentModelAfterHook' => null,
			Hooks::OPTION_USE_CODEMIRROR => true,
			Hooks::OPTION_USE_CODEMIRROR_CODE => true,
			'isRTL' => false,
			Hooks::OPTION_USE_WIKIEDITOR => false,
			'method' => 'edit',
			'reupload' => false,
			'pageLang' => 'en',
			'disableLangConversion' => false,
			'disabledVariants' => [],
			'usePigLatinVariant' => true,
		], $conds );
		$this->overrideConfigValues( [
			'CodeMirrorEnabledModes' => $conds['allowedModes'] ?? [
				Hooks::MODE_MEDIAWIKI => true,
			],
			'DisableLangConversion' => $conds['disableLangConversion'],
			'DisabledVariants' => $conds['disabledVariants'],
			'UsePigLatinVariant' => $conds['usePigLatinVariant'],
		] );

		$out = $this->getMockOutputPage( $conds['contentModel'], $conds['isRTL'], $conds['pageLang'] );
		$out->method( 'getModules' )->willReturn( $conds['module'] ? [ $conds['module'] ] : [] );
		$userOptionsManager = $this->createMock( UserOptionsManager::class );
		$userOptionsManager->method( 'getBoolOption' )
			->willReturnMap( [
				[ $out->getUser(), Hooks::OPTION_USE_CODEMIRROR, 0, $conds[Hooks::OPTION_USE_CODEMIRROR] ],
				[ $out->getUser(), Hooks::OPTION_USE_CODEMIRROR_CODE, 0, $conds[Hooks::OPTION_USE_CODEMIRROR_CODE] ],
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
		$out->method( 'addModuleStyles' )
			->willReturnCallback( static function ( $modules ) use ( &$modulesLoaded ) {
				$modulesLoaded = array_merge( $modulesLoaded, is_array( $modules ) ? $modules : [ $modules ] );
			} );
		$out->method( 'addJsConfigVars' )
			->willReturnCallback( static function ( $vars ) use ( &$jsConfigVars ) {
				// Temporarily deprecation JS config var (T373720)
				if ( is_array( $vars ) ) {
					$jsConfigVars = array_merge( $jsConfigVars, $vars );
				}
			} );

		if ( $conds['contentModelAfterHook'] ) {
			$this->setTemporaryHook( 'CodeMirrorGetMode', static function (
				Title $title, ?string &$mode, string $model,
			) use ( $conds ) {
				$mode = $conds['contentModelAfterHook'];
			} );
		}

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
			if ( !$conds['reupload'] ) {
				$this->assertEquals( '#wpUploadDescription', $jsConfigVars['cmTextarea'] );
			}
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
			if ( $expectedModules ) {
				$this->assertEquals( '#wpTextbox1', $jsConfigVars['cmTextarea'] ?? null );
			}
		}

		// If Extension:Translate is installed, we also expect ext.translate.codemirror
		// wherever ext.CodeMirror is loaded.
		if ( in_array( 'ext.CodeMirror', $expectedModules ) &&
			ExtensionRegistry::getInstance()->isLoaded( 'Translate' )
		) {
			$expectedModules[] = 'ext.translate.codemirror';
		}

		$this->assertArrayEquals( $expectedModules, $modulesLoaded );
		$this->assertEquals( $expectedMode, $jsConfigVars['cmMode'] ?? 'mediawiki' );
		if (
			$conds['disableLangConversion'] ||
			( $conds['pageLang'] === 'en' && !$conds['usePigLatinVariant'] )
		) {
			$this->assertArrayEquals( [], $jsConfigVars['cmLanguageVariants'] );
		} elseif ( $expectedModules ) {
			$langConverterFactory = $this->getServiceContainer()->getLanguageConverterFactory();
			$pageLang = $langFactory->getLanguage( $conds['pageLang'] );
			$variants = $langConverterFactory->getLanguageConverter( $pageLang )->getVariants();
			$this->assertArrayEquals( $variants, $jsConfigVars['cmLanguageVariants'] );
		}
	}

	/**
	 * @return Generator
	 */
	public static function provideOnEditPageShowEditFormInitial(): Generator {
		$cmDefaultModules = [ 'ext.CodeMirror', 'ext.CodeMirror.lib', 'ext.CodeMirror.init' ];
		yield 'default' => [
			[],
			[ ...$cmDefaultModules, 'ext.CodeMirror.mode.mediawiki' ]
		];
		yield 'read-only' => [
			[ 'method' => 'readOnly' ],
			[ ...$cmDefaultModules, 'ext.CodeMirror.mode.mediawiki' ]
		];
		yield 'WikiEditor' => [
			[ Hooks::OPTION_USE_WIKIEDITOR => true ],
			[ ...$cmDefaultModules, 'ext.CodeMirror.mode.mediawiki', 'ext.CodeMirror.WikiEditor' ]
		];
		yield 'WikiEditor, read-only' => [
			[ Hooks::OPTION_USE_WIKIEDITOR => true, 'method' => 'readOnly' ],
			[ ...$cmDefaultModules, 'ext.CodeMirror.mode.mediawiki', 'ext.CodeMirror.WikiEditor' ]
		];
		yield 'RTL' => [
			[ 'isRTL' => true, 'lang' => 'ar' ],
			[ ...$cmDefaultModules, 'ext.CodeMirror.mode.mediawiki' ]
		];
		yield 'contentModel CSS' => [
			[ 'contentModel' => CONTENT_MODEL_CSS, 'allowedModes' => [ Hooks::MODE_CSS => true ] ],
			[ ...$cmDefaultModules, 'ext.CodeMirror.modes' ],
			'css'
		];
		yield 'WikiEditor, contentModel JavaScript' => [
			[
				'contentModel' => CONTENT_MODEL_JAVASCRIPT,
				'allowedModes' => [ CONTENT_MODEL_JAVASCRIPT => true ],
				Hooks::OPTION_USE_WIKIEDITOR => true,
			],
			[ ...$cmDefaultModules, 'ext.CodeMirror.modes',
				'ext.CodeMirror.styles', 'ext.CodeMirror.WikiEditor' ],
			'javascript'
		];
		yield 'contentModel JSON' => [
			[ 'contentModel' => CONTENT_MODEL_JSON, 'allowedModes' => [ Hooks::MODE_JSON => true ] ],
			[ ...$cmDefaultModules, 'ext.CodeMirror.modes' ],
			'json'
		];
		yield 'WikiEditor, contentModel JavaScript, read-only' => [
			[
				'contentModel' => CONTENT_MODEL_JAVASCRIPT,
				'allowedModes' => [ CONTENT_MODEL_JAVASCRIPT => true ],
				'method' => 'readOnly',
				Hooks::OPTION_USE_WIKIEDITOR => true,
			],
			[ ...$cmDefaultModules, 'ext.CodeMirror.modes',
				'ext.CodeMirror.styles', 'ext.CodeMirror.WikiEditor' ],
			'javascript'
		];
		yield 'contentModel CSS, CSS not allowed' => [
			[ 'contentModel' => CONTENT_MODEL_CSS, 'allowedModes' => [ Hooks::MODE_CSS => false ] ],
			[]
		];
		yield 'preference false' => [
			[ Hooks::OPTION_USE_CODEMIRROR => false ],
			[]
		];
		yield 'WikiEditor, WikEd enabled' => [
			[ Hooks::OPTION_USE_WIKIEDITOR => true, 'gadget' => 'wikEd' ],
			[]
		];
		yield 'preference false, WikiEditor' => [
			[ Hooks::OPTION_USE_WIKIEDITOR => true, Hooks::OPTION_USE_CODEMIRROR => false ],
			[ 'ext.CodeMirror.init' ]
		];
		yield 'Special:Upload' => [
			[ 'method' => 'upload' ],
			[ ...$cmDefaultModules, 'ext.CodeMirror.mode.mediawiki' ]
		];
		yield 'Special:Upload, reupload' => [
			[ 'method' => 'upload', 'reupload' => true ],
			[]
		];
		yield 'WikiEditor, Special:Upload' => [
			[ Hooks::OPTION_USE_WIKIEDITOR => true, 'method' => 'upload' ],
			[ ...$cmDefaultModules, 'ext.CodeMirror.mode.mediawiki' ]
		];
		yield 'page language zh' => [
			[ 'pageLang' => 'zh' ],
			[ ...$cmDefaultModules, 'ext.CodeMirror.mode.mediawiki' ]
		];
		yield 'Special:ExpandTemplates' => [
			[ 'method' => 'expandTemplates' ],
			[ ...$cmDefaultModules, 'ext.CodeMirror.mode.mediawiki' ]
		];
		yield 'page language zh with conversion disabled' => [
			[ 'pageLang' => 'zh', 'disableLangConversion' => true ],
			[ ...$cmDefaultModules, 'ext.CodeMirror.mode.mediawiki' ]
		];
		yield 'page language wuu with all variants disabled' => [
			[ 'pageLang' => 'wuu', 'disabledVariants' => [ 'wuu-hans', 'wuu-hant' ] ],
			[ ...$cmDefaultModules, 'ext.CodeMirror.mode.mediawiki' ]
		];
		yield 'page language en with Pig Latin variant disabled' => [
			[ 'pageLang' => 'en', 'usePigLatinVariant' => false ],
			[ ...$cmDefaultModules, 'ext.CodeMirror.mode.mediawiki' ]
		];
		yield 'preference false, WikiEditor, contentModel JSON' => [
			[
				Hooks::OPTION_USE_WIKIEDITOR => true,
				Hooks::OPTION_USE_CODEMIRROR => false,
				'contentModel' => CONTENT_MODEL_JSON,
				'allowedModes' => [ Hooks::MODE_JSON => true ],
			],
			[ ...$cmDefaultModules, 'ext.CodeMirror.modes',
				'ext.CodeMirror.styles', 'ext.CodeMirror.WikiEditor' ],
			'json'
		];
		yield 'preference false, WikiEditor, contentModel Chart.JsonConifg' => [
			[
				Hooks::OPTION_USE_WIKIEDITOR => true,
				Hooks::OPTION_USE_CODEMIRROR => false,
				'contentModel' => 'Chart.JsonConfig',
				'contentModelAfterHook' => CONTENT_MODEL_JSON,
				'allowedModes' => [ Hooks::MODE_JSON => true ],
			],
			[ ...$cmDefaultModules, 'ext.CodeMirror.modes',
				'ext.CodeMirror.styles', 'ext.CodeMirror.WikiEditor' ],
			'json'
		];
	}

	public function testPreferenceRegistered() {
		$user = self::getTestUser()->getUser();
		$context = RequestContext::getMain();
		$context->setTitle( Title::makeTitle( NS_MAIN, 'PreferenceRegistered' ) );
		$kinds = $this->getServiceContainer()->getPreferencesFactory()
			->getResetKinds( $user, $context, [ Hooks::OPTION_USE_CODEMIRROR => 1 ] );
		self::assertEquals( 'registered', $kinds[Hooks::OPTION_USE_CODEMIRROR] );
	}

	public function testOnGetPreferences(): void {
		$this->overrideConfigValue( 'CodeMirrorEnabledModes', [
			Hooks::MODE_MEDIAWIKI => true,
			Hooks::MODE_JAVASCRIPT => true,
		] );
		$user = self::getTestUser()->getUser();
		$config = $this->getServiceContainer()->getMainConfig();
		$hookContainer = $this->getServiceContainer()->getHookContainer();
		$langConverterFactory = $this->getServiceContainer()->getLanguageConverterFactory();
		$userOptionsManager = $this->getServiceContainer()->getUserOptionsManager();
		$hooks = new Hooks( $config, $hookContainer, $langConverterFactory, $userOptionsManager, null );
		$preferences = [];
		$hooks->onGetPreferences( $user, $preferences );
		self::assertArrayHasKey( Hooks::OPTION_USE_CODEMIRROR, $preferences );
		self::assertArrayHasKey( Hooks::OPTION_USE_CODEMIRROR_CODE, $preferences );
		self::assertArrayHasKey( Hooks::OPTION_COLORBLIND, $preferences );
		self::assertArrayHasKey( 'usecodemirror-summary', $preferences );
		self::assertSame( 'toggle', $preferences[Hooks::OPTION_USE_CODEMIRROR]['type'] );
		self::assertSame( 'toggle', $preferences[Hooks::OPTION_USE_CODEMIRROR_CODE]['type'] );
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
