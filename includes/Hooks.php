<?php
declare( strict_types = 1 );

namespace MediaWiki\Extension\CodeMirror;

use InvalidArgumentException;
use MediaWiki\Config\Config;
use MediaWiki\EditPage\EditPage;
use MediaWiki\Extension\CodeMirror\Hooks\HookRunner;
use MediaWiki\Extension\Gadgets\GadgetRepo;
use MediaWiki\Hook\EditPage__showEditForm_initialHook;
use MediaWiki\Hook\EditPage__showReadOnlyForm_initialHook;
use MediaWiki\HookContainer\HookContainer;
use MediaWiki\Language\LanguageConverter;
use MediaWiki\Language\LanguageConverterFactory;
use MediaWiki\MainConfigNames;
use MediaWiki\Output\OutputPage;
use MediaWiki\Preferences\Hook\GetPreferencesHook;
use MediaWiki\Registration\ExtensionRegistry;
use MediaWiki\SpecialPage\Hook\SpecialPageBeforeExecuteHook;
use MediaWiki\SpecialPage\SpecialPage;
use MediaWiki\Specials\Hook\UploadForm_initialHook;
use MediaWiki\Specials\SpecialUpload;
use MediaWiki\Title\Title;
use MediaWiki\User\Options\UserOptionsManager;
use MediaWiki\User\User;

class Hooks implements
	EditPage__showEditForm_initialHook,
	EditPage__showReadOnlyForm_initialHook,
	UploadForm_initialHook,
	SpecialPageBeforeExecuteHook,
	GetPreferencesHook
{

	private readonly HookRunner $hookRunner;
	private readonly array $conflictingGadgets;
	private readonly string $extensionAssetsPath;
	private readonly bool $debugMode;
	private readonly array $enabledModes;
	private bool $readOnly = false;
	private bool $isEditPage = false;

	public const MODE_MEDIAWIKI = 'mediawiki';
	public const MODE_JAVASCRIPT = 'javascript';
	public const MODE_CSS = 'css';
	public const MODE_JSON = 'json';
	public const MODE_LUA = 'lua';
	public const MODE_VUE = 'vue';
	public const SUPPORTED_MODES = [
		self::MODE_MEDIAWIKI,
		self::MODE_JAVASCRIPT,
		self::MODE_CSS,
		self::MODE_JSON,
		self::MODE_VUE,
		self::MODE_LUA,
	];

	public const OPTION_USE_CODEMIRROR = 'usecodemirror';
	public const OPTION_USE_CODEMIRROR_CODE = 'usecodemirror-code';
	public const OPTION_CODEMIRROR_PREFS = 'codemirror-preferences';
	public const OPTION_CODEMIRROR_PREFS_CODE = 'codemirror-preferences-code';
	public const OPTION_COLORBLIND = 'usecodemirror-colorblind';
	public const OPTION_USE_WIKIEDITOR = 'usebetatoolbar';

	public const NO_PRIMARY_TEXTAREA = 0;

	public function __construct(
		Config $config,
		HookContainer $hookContainer,
		private readonly LanguageConverterFactory $languageConverterFactory,
		private readonly UserOptionsManager $userOptionsManager,
		private readonly ?GadgetRepo $gadgetRepo,
	) {
		$this->hookRunner = new HookRunner( $hookContainer );
		$this->conflictingGadgets = $config->get( 'CodeMirrorConflictingGadgets' );
		$this->extensionAssetsPath = $config->get( MainConfigNames::ExtensionAssetsPath );
		$this->debugMode = $config->get( MainConfigNames::ShowExceptionDetails );
		$this->enabledModes = array_keys( array_filter( $config->get( 'CodeMirrorEnabledModes' ) ) );
	}

	/**
	 * Get the mode based on the content model of the given Title.
	 *
	 * @param Title $title
	 * @return string|null
	 */
	private function getMode( Title $title ): ?string {
		$mode = match ( $title->getContentModel() ) {
			// Natively supported content models and their canonical modes.
			CONTENT_MODEL_WIKITEXT => self::MODE_MEDIAWIKI,
			CONTENT_MODEL_JSON => self::MODE_JSON,
			CONTENT_MODEL_CSS => self::MODE_CSS,
			CONTENT_MODEL_JAVASCRIPT => self::MODE_JAVASCRIPT,
			CONTENT_MODEL_VUE => self::MODE_VUE,
			default => null,
		};

		// Allow extensions to override the mode via hook.
		$this->hookRunner->onCodeMirrorGetMode( $title, $mode, $title->getContentModel() );

		// Verify this mode is enabled.
		if ( !in_array( $mode, $this->enabledModes ) ) {
			return null;
		}

		return $mode;
	}

	/**
	 * Get the option name (preference) that dictates whether CodeMirror should be enabled for a given mode.
	 *
	 * @param string $mode
	 * @return string
	 */
	private function getOptionName( string $mode ): string {
		return match ( $mode ) {
			self::MODE_MEDIAWIKI => self::OPTION_USE_CODEMIRROR,
			default => self::OPTION_USE_CODEMIRROR_CODE,
		};
	}

	/**
	 * Checks if any CodeMirror modules should be loaded on this page or not.
	 * Ultimately ::loadInitModules() decides which module(s) get loaded.
	 *
	 * @param OutputPage $out
	 * @param ExtensionRegistry|null $extensionRegistry Overridden in tests.
	 * @param bool $supportWikiEditor
	 * @return bool
	 */
	public function shouldLoadCodeMirror(
		OutputPage $out,
		?ExtensionRegistry $extensionRegistry = null,
		bool $supportWikiEditor = true
	): bool {
		$mode = $this->getMode( $out->getTitle() );
		if ( $mode === null ) {
			return false;
		}
		$useCodeMirror = $this->userOptionsManager->getBoolOption( $out->getUser(), $this->getOptionName( $mode ) );
		$useWikiEditor = $supportWikiEditor &&
			$this->userOptionsManager->getBoolOption( $out->getUser(), self::OPTION_USE_WIKIEDITOR );
		// Either WikiEditor or the preference must be enabled.
		if ( !$useWikiEditor && !$useCodeMirror ) {
			return false;
		}

		$extensionRegistry ??= ExtensionRegistry::getInstance();
		// Disable CodeMirror if we're on an edit page with a conflicting gadget (T178348)
		return !$this->conflictingGadgetsEnabled( $extensionRegistry, $out->getUser() );
	}

	/**
	 * @param ExtensionRegistry $extensionRegistry
	 * @param User $user
	 * @return bool
	 */
	private function conflictingGadgetsEnabled( ExtensionRegistry $extensionRegistry, User $user ): bool {
		if ( !$extensionRegistry->isLoaded( 'Gadgets' ) || !$this->gadgetRepo ) {
			return false;
		}
		$conflictingGadgets = array_intersect( $this->conflictingGadgets, $this->gadgetRepo->getGadgetIds() );
		foreach ( $conflictingGadgets as $conflictingGadget ) {
			try {
				if ( $this->gadgetRepo->getGadget( $conflictingGadget )->isEnabled( $user ) ) {
					return true;
				}
			} catch ( InvalidArgumentException ) {
				// Safeguard for an invalid gadget ID; treat as gadget not enabled.
				continue;
			}
		}
		return false;
	}

	/**
	 * @see https://www.mediawiki.org/wiki/Manual:Hooks/EditPage::showEditForm:initial
	 *
	 * @param EditPage $editor
	 * @param OutputPage $out
	 */
	public function onEditPage__showEditForm_initial( $editor, $out ): void {
		if ( !$this->shouldLoadCodeMirror( $out ) ) {
			return;
		}
		$this->isEditPage = true;
		// Pre-deliver modules for faster loading.
		$this->loadInitModules( $out );
	}

	/**
	 * Set client-side JS variables and pre-deliver modules for optimal performance.
	 * `cmRLModules` is a list of modules that will be lazy-loaded by the client, and,
	 * if the 'usecodemirror' or 'usecodemirror-code' preference is enabled (depending
	 * on the mode), pre-delivered by ResourceLoader.
	 *
	 * @param OutputPage $out
	 * @param bool $supportWikiEditor
	 * @param string[] $textareas The first will be treated as the main textarea.
	 */
	private function loadInitModules(
		OutputPage $out,
		bool $supportWikiEditor = true,
		array $textareas = [ '#wpTextbox1' ]
	): void {
		$mode = $this->getMode( $out->getTitle() );
		if ( $mode === null ) {
			return;
		}
		$useCodeMirror = $this->userOptionsManager->getBoolOption( $out->getUser(), $this->getOptionName( $mode ) );
		$useWikiEditor = $supportWikiEditor &&
			$this->userOptionsManager->getBoolOption( $out->getUser(), self::OPTION_USE_WIKIEDITOR );
		$modules = [
			'ext.CodeMirror',
			...( $useWikiEditor ? [ 'ext.CodeMirror.WikiEditor' ] : [] ),
			'ext.CodeMirror.lib',
			'ext.CodeMirror.init',
		];

		if ( in_array( $mode, self::SUPPORTED_MODES, true ) ) {
			$modules[] = 'ext.CodeMirror.' . ( $mode === self::MODE_MEDIAWIKI ? 'mode.mediawiki' : 'modes' );
		} else {
			wfLogWarning( "[CodeMirror] Unsupported CodeMirror mode '$mode'" );
			$modules = [];
		}

		// Load modules from CodeMirrorPluginModules extension attribute.
		$pluginModules = ExtensionRegistry::getInstance()->getAttribute( 'CodeMirrorPluginModules' ) ?? [];
		foreach ( $pluginModules as $module ) {
			$modules[] = $module;
		}

		if ( $useCodeMirror ) {
			// Pre-load modules if we know we're going to need them.
			$out->addModules( $modules );
		} elseif ( $useWikiEditor ) {
			// Load only the init module, which will add the toolbar button
			// and lazy-load the rest of the modules via the cmRLModules config variable.
			$out->addModules( 'ext.CodeMirror.init' );
		}

		if ( $useCodeMirror && $useWikiEditor && $mode !== self::MODE_MEDIAWIKI && $this->isEditPage ) {
			$this->addStyleModule( $out );
		}

		$mainTextarea = $textareas[0];
		$childTextareas = array_slice( $textareas, 1 );

		$lang = $out->getTitle()->getPageLanguage();
		$code = mb_strtolower( $lang->getCode() );
		$variants = [];
		if (
			!$this->languageConverterFactory->isConversionDisabled() &&
			in_array( $code, LanguageConverter::$languagesWithVariants )
		) {
			$converter = $this->languageConverterFactory->getLanguageConverter( $lang );
			// Language conversion is disabled for English if `$wgUsePigLatinVariant` is falsy.
			// The `getLanguageVariants` method exists in EnConverter but not in TrivialLanguageConverter.
			if ( $code !== 'en' || method_exists( $converter, 'getLanguageVariants' ) ) {
				$variants = $converter->getVariants();
			}
		}
		$out->addJsConfigVars( [
			'cmRLModules' => $modules,
			'cmReadOnly' => $this->readOnly,
			'cmLanguageVariants' => $variants,
			'cmMode' => $mode,
			'cmTextarea' => $mainTextarea,
			'cmChildTextareas' => $childTextareas,
			'cmDebug' => $this->debugMode
		] );
	}

	/**
	 * Add render-blocking styles to avoid FOUC in code editors.
	 *
	 * @todo Add server-side fetching of CM preferences and add a CSS class
	 *   for line numbering and linting so we can style accordingly.
	 * @param OutputPage $out
	 */
	private function addStyleModule( OutputPage $out ): void {
		$out->addBodyClasses( 'cm-mw-wikieditor-loading' );
		$out->addModuleStyles( 'ext.CodeMirror.styles' );
	}

	/**
	 * @see https://www.mediawiki.org/wiki/Manual:Hooks/EditPage::showReadOnlyForm:initial
	 *
	 * @param EditPage $editor
	 * @param OutputPage $out
	 */
	public function onEditPage__showReadOnlyForm_initial( $editor, $out ): void {
		if ( $this->shouldLoadCodeMirror( $out ) ) {
			$this->isEditPage = true;
			$this->readOnly = true;
			$this->loadInitModules( $out );
		}
	}

	/**
	 * @see https://www.mediawiki.org/wiki/Manual:Hooks/UploadForm:initial
	 *
	 * @param SpecialUpload $upload
	 */
	public function onUploadForm_initial( $upload ): void {
		if ( $upload->mForReUpload ) {
			return;
		}
		$out = $upload->getOutput();
		if ( $this->shouldLoadCodeMirror( $out, null, false ) ) {
			$this->loadInitModules( $out, false, [ '#wpUploadDescription' ] );
		}
	}

	/**
	 * @see https://www.mediawiki.org/wiki/Manual:Hooks/SpecialPageBeforeExecute
	 *
	 * @param SpecialPage $special
	 * @param string $subPage
	 */
	public function onSpecialPageBeforeExecute( $special, $subPage ): void {
		$output = $special->getOutput();
		if (
			$special->getName() === 'ExpandTemplates' &&
			$this->shouldLoadCodeMirror( $output, null, false )
		) {
			$this->loadInitModules( $output, false, [ '[name=wpInput]', '#output' ] );
			return;
		}

		// Allow extensions to load CodeMirror on other special pages.
		$textareas = [];
		$this->hookRunner->onCodeMirrorSpecialPage( $special, $textareas );
		if (
			$textareas &&
			$this->shouldLoadCodeMirror( $output, null, false )
		) {
			$this->loadInitModules( $output, false, $textareas );
		}
	}

	/**
	 * GetPreferences hook handler
	 *
	 * @see https://www.mediawiki.org/wiki/Manual:Hooks/GetPreferences
	 *
	 * @param User $user
	 * @param array &$defaultPreferences
	 * @return bool|void True or no return value to continue or false to abort
	 */
	public function onGetPreferences( $user, &$defaultPreferences ) {
		// Show message with a link to the Help page under "Syntax highlighting".
		// The following messages are generated upstream by the 'section' value:
		// * prefs-syntax-highlighting
		$defaultPreferences['usecodemirror-summary'] = [
			'type' => 'info',
			'default' => wfMessage( 'codemirror-prefs-summary' )->parse(),
			'raw' => true,
			'section' => 'editing/syntax-highlighting'
		];

		$defaultPreferences[self::OPTION_USE_CODEMIRROR] = [
			'type' => 'toggle',
			'label-message' => 'codemirror-prefs-enable',
			'help-message' => 'codemirror-prefs-enable-help',
			'section' => 'editing/syntax-highlighting',
		];

		if ( array_diff( $this->enabledModes, [ 'mediawiki' ] ) ) {
			$defaultPreferences[self::OPTION_USE_CODEMIRROR_CODE] = [
				'type' => 'toggle',
				'label-message' => 'codemirror-prefs-enable-code',
				'help-message' => 'codemirror-prefs-enable-code-help',
				'section' => 'editing/syntax-highlighting',
			];
		}

		$defaultPreferences[self::OPTION_COLORBLIND] = [
			'type' => 'toggle',
			'label-message' => 'codemirror-prefs-colorblind',
			'section' => 'editing/syntax-highlighting',
			'disable-if' => [ '!==', self::OPTION_USE_CODEMIRROR, '1' ]
		];

		$defaultPreferences[self::OPTION_CODEMIRROR_PREFS] = [
			'type' => 'api',
		];

		$defaultPreferences[self::OPTION_CODEMIRROR_PREFS_CODE] = [
			'type' => 'api',
		];
	}
}
