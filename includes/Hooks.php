<?php
declare( strict_types = 1 );

namespace MediaWiki\Extension\CodeMirror;

use InvalidArgumentException;
use MediaWiki\Config\Config;
use MediaWiki\EditPage\EditPage;
use MediaWiki\Extension\BetaFeatures\BetaFeatures;
use MediaWiki\Extension\CodeMirror\Hooks\HookRunner;
use MediaWiki\Extension\Gadgets\GadgetRepo;
use MediaWiki\Hook\EditPage__showEditForm_initialHook;
use MediaWiki\Hook\EditPage__showReadOnlyForm_initialHook;
use MediaWiki\HookContainer\HookContainer;
use MediaWiki\HTMLForm\HTMLForm;
use MediaWiki\Languages\LanguageConverterFactory;
use MediaWiki\MainConfigNames;
use MediaWiki\Output\OutputPage;
use MediaWiki\Preferences\Hook\GetPreferencesHook;
use MediaWiki\Preferences\Hook\PreferencesFormPreSaveHook;
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
	GetPreferencesHook,
	PreferencesFormPreSaveHook
{

	private readonly HookRunner $hookRunner;
	private readonly bool $useV6;
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
	public const OPTION_COLORBLIND = 'usecodemirror-colorblind';
	public const OPTION_BETA_FEATURE = 'codemirror-beta-feature-enable';
	public const OPTION_USE_WIKIEDITOR = 'usebetatoolbar';

	public function __construct(
		Config $config,
		HookContainer $hookContainer,
		private readonly LanguageConverterFactory $languageConverterFactory,
		private readonly UserOptionsManager $userOptionsManager,
		private readonly ?GadgetRepo $gadgetRepo,
	) {
		$this->hookRunner = new HookRunner( $hookContainer );
		$this->useV6 = $config->get( 'CodeMirrorV6' );
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
		$shouldUseV6 = $this->shouldUseV6( $out );
		$useCodeMirror = $this->userOptionsManager->getBoolOption( $out->getUser(), self::OPTION_USE_CODEMIRROR );
		$useWikiEditor = $supportWikiEditor &&
			$this->userOptionsManager->getBoolOption( $out->getUser(), self::OPTION_USE_WIKIEDITOR );
		// Disable CodeMirror 5 when the WikiEditor toolbar is not enabled in preferences.
		if ( !$shouldUseV6 && !$useWikiEditor ) {
			return false;
		}
		// In CodeMirror 6, either WikiEditor or the 'usecodemirror' preference must be enabled.
		if ( $shouldUseV6 && !$useWikiEditor && !$useCodeMirror ) {
			return false;
		}

		$extensionRegistry ??= ExtensionRegistry::getInstance();
		$contentModel = $out->getTitle()->getContentModel();
		$isEnabledMode = $this->getMode( $out->getTitle() ) !== null;
		$isRTL = $out->getTitle()->getPageLanguage()->isRTL();
		// Disable CodeMirror if we're on an edit page with a conflicting gadget (T178348)
		return !$this->conflictingGadgetsEnabled( $extensionRegistry, $out->getUser() ) &&
			// CodeMirror 5 on any textarea doesn't support RTL (T170001)
			( !$isRTL || $shouldUseV6 ) &&
			// Limit to supported content models. CM5 only supports wikitext.
			// See https://www.mediawiki.org/wiki/Content_handlers#Extension_content_handlers
			(
				( $shouldUseV6 && $isEnabledMode ) ||
				( !$shouldUseV6 && $contentModel === CONTENT_MODEL_WIKITEXT )
			);
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
		$useCodeMirror = $this->userOptionsManager->getBoolOption( $out->getUser(), self::OPTION_USE_CODEMIRROR );
		$useWikiEditor = $this->userOptionsManager->getBoolOption( $out->getUser(), self::OPTION_USE_WIKIEDITOR );

		if ( $this->shouldUseV6( $out ) ) {
			// Pre-deliver modules for faster loading.
			$this->loadInitModules( $out );
		} elseif ( $useWikiEditor ) {
			// Legacy CM5

			// ext.CodeMirror.WikiEditor adds the toggle button to the toolbar.
			$out->addModules( 'ext.CodeMirror.WikiEditor' );

			if ( $useCodeMirror ) {
				// These modules are predelivered for performance when needed
				// keep these modules in sync with ext.CodeMirror.js
				$out->addModules( [ 'ext.CodeMirror.lib', 'ext.CodeMirror.mode.mediawiki' ] );
			}
		}
	}

	/**
	 * Set client-side JS variables and pre-deliver modules for optimal performance.
	 * `cmRLModules` is a list of modules that will be lazy-loaded by the client, and,
	 * if the 'usecodemirror' preference is enabled, pre-delivered by ResourceLoader.
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
		$useCodeMirror = $this->userOptionsManager->getBoolOption( $out->getUser(), self::OPTION_USE_CODEMIRROR );
		$useWikiEditor = $supportWikiEditor &&
			$this->userOptionsManager->getBoolOption( $out->getUser(), self::OPTION_USE_WIKIEDITOR );
		$modules = [
			'ext.CodeMirror.v6',
			...( $useWikiEditor ? [ 'ext.CodeMirror.v6.WikiEditor' ] : [] ),
			'ext.CodeMirror.v6.lib',
			'ext.CodeMirror.v6.init',
		];
		$mode = $this->getMode( $out->getTitle() );

		if ( in_array( $mode, self::SUPPORTED_MODES, true ) ) {
			$modules[] = 'ext.CodeMirror.v6.' . ( $mode === self::MODE_MEDIAWIKI ? 'mode.mediawiki' : 'modes' );
		} else {
			wfLogWarning( "[CodeMirror] Unsupported CodeMirror mode '$mode'" );
			$modules = [];
		}

		if ( $useCodeMirror ) {
			// Pre-load modules if we know we're going to need them.
			$out->addModules( $modules );
		} elseif ( $useWikiEditor ) {
			// Load only the init module, which will add the toolbar button
			// and lazy-load the rest of the modules via the cmRLModules config variable.
			$out->addModules( 'ext.CodeMirror.v6.init' );
		}

		if ( $useCodeMirror && $useWikiEditor && $mode !== self::MODE_MEDIAWIKI && $this->isEditPage ) {
			$this->addStyleModule( $out );
		}

		$mainTextarea = $textareas[0];
		$childTextareas = array_slice( $textareas, 1 );

		$out->addJsConfigVars( [
			'cmRLModules' => $modules,
			'cmReadOnly' => $this->readOnly,
			'cmLanguageVariants' => $this->languageConverterFactory->getLanguageConverter(
				$out->getTitle()->getPageLanguage()
			)->getVariants(),
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
		$out->addModuleStyles( 'ext.CodeMirror.v6.styles' );
	}

	/**
	 * @see https://www.mediawiki.org/wiki/Manual:Hooks/EditPage::showReadOnlyForm:initial
	 *
	 * @param EditPage $editor
	 * @param OutputPage $out
	 */
	public function onEditPage__showReadOnlyForm_initial( $editor, $out ): void {
		if ( $this->shouldUseV6( $out ) && $this->shouldLoadCodeMirror( $out ) ) {
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
		if ( $this->shouldUseV6( $out ) && $this->shouldLoadCodeMirror( $out, null, false ) ) {
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
			$this->shouldUseV6( $output ) &&
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
			$this->shouldUseV6( $output ) &&
			$this->shouldLoadCodeMirror( $output, null, false )
		) {
			$this->loadInitModules( $output, false, $textareas );
		}
	}

	/**
	 * @param OutputPage $out
	 * @return bool
	 * @todo Remove check for cm6enable flag after migration is complete
	 */
	private function shouldUseV6( OutputPage $out ): bool {
		return $this->useV6 || $out->getRequest()->getFuzzyBool( 'cm6enable' ) || (
			$this->isBetaFeatureEnabled( $out->getUser() ) &&
			$out->getRequest()->getFuzzyBool( 'cm6enable', true )
		);
	}

	/**
	 * @param User $user
	 * @return bool
	 */
	private function isBetaFeatureEnabled( User $user ): bool {
		return ExtensionRegistry::getInstance()->isLoaded( 'BetaFeatures' ) &&
			BetaFeatures::isFeatureEnabled( $user, self::OPTION_BETA_FEATURE );
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
		if ( !$this->useV6 && !$this->isBetaFeatureEnabled( $user ) ) {
			$defaultPreferences[self::OPTION_USE_CODEMIRROR] = [
				'type' => 'api',
			];

			// The following messages are generated upstream by the 'section' value
			// * prefs-accessibility
			$defaultPreferences[self::OPTION_COLORBLIND] = [
				'type' => 'toggle',
				'label-message' => 'codemirror-prefs-colorblind',
				'help-message' => 'codemirror-prefs-colorblind-help',
				'section' => 'editing/accessibility',
			];
			return;
		}

		// Show message with a link to the Help page under "Syntax highlighting".
		// The following messages are generated upstream by the 'section' value:
		// * prefs-syntax-highlighting
		$defaultPreferences['usecodemirror-summary'] = [
			'type' => 'info',
			'default' => wfMessage( 'codemirror-prefs-summary' )->parse(),
			'raw' => true,
			'section' => 'editing/syntax-highlighting'
		];

		// CodeMirror is disabled by default for all users. It can enabled for everyone
		// by default by adding '$wgDefaultUserOptions['usecodemirror'] = 1;' into LocalSettings.php
		$defaultPreferences[self::OPTION_USE_CODEMIRROR] = [
			'type' => 'toggle',
			'label-message' => 'codemirror-prefs-enable',
			'section' => 'editing/syntax-highlighting',
		];

		$defaultPreferences[self::OPTION_COLORBLIND] = [
			'type' => 'toggle',
			'label-message' => 'codemirror-prefs-colorblind',
			'section' => 'editing/syntax-highlighting',
			'disable-if' => [ '!==', self::OPTION_USE_CODEMIRROR, '1' ]
		];

		$defaultPreferences['codemirror-preferences'] = [
			'type' => 'api',
		];
	}

	/**
	 * GetBetaFeaturePreferences hook handler
	 *
	 * @param User $user
	 * @param array &$betaPrefs
	 */
	public function onGetBetaFeaturePreferences( User $user, array &$betaPrefs ): void {
		if ( $this->useV6 ) {
			return;
		}
		$betaPrefs[ self::OPTION_BETA_FEATURE ] = [
			'label-message' => 'codemirror-beta-feature-title',
			'desc-message' => 'codemirror-beta-feature-description',
			'screenshot' => [
				'ltr' => $this->extensionAssetsPath . '/CodeMirror/resources/images/codemirror.beta-feature-ltr.svg',
				'rtl' => $this->extensionAssetsPath . '/CodeMirror/resources/images/codemirror.beta-feature-rtl.svg'
			],
			'info-link' => 'https://www.mediawiki.org/wiki/Special:MyLanguage/Help:Extension:CodeMirror',
			'discussion-link' => 'https://www.mediawiki.org/wiki/Help_talk:Extension:CodeMirror'
		];
	}

	/**
	 * When a user enables the CodeMirror beta feature, automatically enable the 'usecodemirror' preference.
	 *
	 * @param array $formData
	 * @param HTMLForm $form
	 * @param User $user
	 * @param bool &$result
	 * @param array $oldUserOptions
	 */
	public function onPreferencesFormPreSave( $formData, $form, $user, &$result, $oldUserOptions ) {
		if ( ( $formData[self::OPTION_BETA_FEATURE] ?? false ) &&
			!( $oldUserOptions[self::OPTION_BETA_FEATURE] ?? false )
		) {
			$this->userOptionsManager->setOption( $user, self::OPTION_USE_CODEMIRROR, 1 );
		}
	}
}
