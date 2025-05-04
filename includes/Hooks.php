<?php

namespace MediaWiki\Extension\CodeMirror;

use InvalidArgumentException;
use MediaWiki\Config\Config;
use MediaWiki\EditPage\EditPage;
use MediaWiki\Extension\BetaFeatures\BetaFeatures;
use MediaWiki\Extension\CodeMirror\Hooks\HookRunner;
use MediaWiki\Extension\Gadgets\GadgetRepo;
use MediaWiki\Hook\EditPage__showEditForm_initialHook;
use MediaWiki\Hook\EditPage__showReadOnlyForm_initialHook;
use MediaWiki\Hook\UploadForm_initialHook;
use MediaWiki\HookContainer\HookContainer;
use MediaWiki\Languages\LanguageConverterFactory;
use MediaWiki\MainConfigNames;
use MediaWiki\Output\OutputPage;
use MediaWiki\Preferences\Hook\GetPreferencesHook;
use MediaWiki\Registration\ExtensionRegistry;
use MediaWiki\Specials\SpecialUpload;
use MediaWiki\Title\Title;
use MediaWiki\User\Options\UserOptionsLookup;
use MediaWiki\User\User;

/**
 * @phpcs:disable MediaWiki.NamingConventions.LowerCamelFunctionsName.FunctionName
 */
class Hooks implements
	EditPage__showEditForm_initialHook,
	EditPage__showReadOnlyForm_initialHook,
	UploadForm_initialHook,
	GetPreferencesHook
{

	private UserOptionsLookup $userOptionsLookup;
	private array $conflictingGadgets;
	private bool $useV6;
	private ?GadgetRepo $gadgetRepo;
	private string $extensionAssetsPath;
	private bool $debugMode;
	private bool $readOnly = false;
	private array $contentModels;
	private HookRunner $hookRunner;
	private LanguageConverterFactory $languageConverterFactory;

	/**
	 * @param UserOptionsLookup $userOptionsLookup
	 * @param HookContainer $hookContainer
	 * @param LanguageConverterFactory $languageConverterFactory
	 * @param Config $config
	 * @param GadgetRepo|null $gadgetRepo
	 */
	public function __construct(
		UserOptionsLookup $userOptionsLookup,
		HookContainer $hookContainer,
		LanguageConverterFactory $languageConverterFactory,
		Config $config,
		?GadgetRepo $gadgetRepo
	) {
		$this->userOptionsLookup = $userOptionsLookup;
		$this->hookRunner = new HookRunner( $hookContainer );
		$this->useV6 = $config->get( 'CodeMirrorV6' );
		$this->conflictingGadgets = $config->get( 'CodeMirrorConflictingGadgets' );
		$this->gadgetRepo = $gadgetRepo;
		$this->extensionAssetsPath = $config->get( MainConfigNames::ExtensionAssetsPath );
		$this->debugMode = $config->get( MainConfigNames::ShowExceptionDetails );
		$this->contentModels = $config->get( 'CodeMirrorContentModels' );
		$this->languageConverterFactory = $languageConverterFactory;
	}

	/**
	 * Get the mode for the given title and content model.
	 *
	 * @param Title $title
	 * @param string $model
	 * @return string|null
	 */
	private function getMode( Title $title, string $model ): ?string {
		if ( $model === CONTENT_MODEL_WIKITEXT ) {
			return 'mediawiki';
		} elseif ( $model === CONTENT_MODEL_JAVASCRIPT ) {
			return 'javascript';
		} elseif ( $model === CONTENT_MODEL_CSS ) {
			return 'css';
		} elseif ( $model === CONTENT_MODEL_JSON ) {
			return 'json';
		}

		$mode = null;
		$this->hookRunner->onCodeMirrorGetMode( $title, $mode, $model );

		return $mode;
	}

	/**
	 * Checks if any CodeMirror modules should be loaded on this page or not.
	 * Ultimately ::loadCodeMirrorOnEditPage() decides which module(s) get loaded.
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
		$useCodeMirror = $this->userOptionsLookup->getBoolOption( $out->getUser(), 'usecodemirror' );
		$useWikiEditor = $supportWikiEditor &&
			$this->userOptionsLookup->getBoolOption( $out->getUser(), 'usebetatoolbar' );
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
		// b/c: CodeMirrorContentModels extension attribute used to be a flat string array.
		$isSupportedContentModel = $contentModel && (
			isset( $this->contentModels[ $contentModel ] ) ||
			in_array( $contentModel, $this->contentModels, true )
		);
		$isRTL = $out->getTitle()->getPageLanguage()->isRTL();
		// Disable CodeMirror if we're on an edit page with a conflicting gadget (T178348)
		return !$this->conflictingGadgetsEnabled( $extensionRegistry, $out->getUser() ) &&
			// CodeMirror 5 on any textarea doesn't support RTL (T170001)
			( !$isRTL || $shouldUseV6 ) &&
			// Limit to supported content models. CM5 only supports wikitext.
			// See https://www.mediawiki.org/wiki/Content_handlers#Extension_content_handlers
			(
				( $shouldUseV6 && $isSupportedContentModel ) ||
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
			} catch ( InvalidArgumentException $e ) {
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

		$useCodeMirror = $this->userOptionsLookup->getBoolOption( $out->getUser(), 'usecodemirror' );
		$useWikiEditor = $this->userOptionsLookup->getBoolOption( $out->getUser(), 'usebetatoolbar' );

		if ( $this->shouldUseV6( $out ) ) {
			// Pre-deliver modules for faster loading.
			$this->loadCodeMirrorOnEditPage( $out );
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
	 */
	private function loadCodeMirrorOnEditPage( OutputPage $out, bool $supportWikiEditor = true ): void {
		$useCodeMirror = $this->userOptionsLookup->getBoolOption( $out->getUser(), 'usecodemirror' );
		$useWikiEditor = $supportWikiEditor &&
			$this->userOptionsLookup->getBoolOption( $out->getUser(), 'usebetatoolbar' );
		$modules = [
			'ext.CodeMirror.v6',
			...( $useWikiEditor ? [ 'ext.CodeMirror.v6.WikiEditor' ] : [] ),
			'ext.CodeMirror.v6.lib',
			'ext.CodeMirror.v6.init',
		];
		$contentModel = $out->getTitle()->getContentModel();
		$mode = $this->getMode( $out->getTitle(), $contentModel ) ?? $contentModel;

		if ( in_array( $mode, [ 'mediawiki', 'javascript', 'json', 'css' ] ) ) {
			$modules[] = 'ext.CodeMirror.v6.mode.' . $mode;
		} else {
			wfLogWarning( '[CodeMirror] Unsupported content model ' . $contentModel );
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

		$out->addJsConfigVars( [
			'cmRLModules' => $modules,
			'cmReadOnly' => $this->readOnly,
			'cmDebug' => $this->debugMode,
			'cmLanguageVariants' => $this->languageConverterFactory->getLanguageConverter(
				$out->getTitle()->getPageLanguage()
			)->getVariants(),
			'cmMode' => $mode,
		] );
	}

	/**
	 * @see https://www.mediawiki.org/wiki/Manual:Hooks/EditPage::showReadOnlyForm:initial
	 *
	 * @param EditPage $editor
	 * @param OutputPage $out
	 */
	public function onEditPage__showReadOnlyForm_initial( $editor, $out ): void {
		if ( $this->shouldUseV6( $out ) && $this->shouldLoadCodeMirror( $out ) ) {
			$this->readOnly = true;
			$this->loadCodeMirrorOnEditPage( $out );
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
			$this->loadCodeMirrorOnEditPage( $out, false );
		}
	}

	/**
	 * @param OutputPage $out
	 * @return bool
	 * @todo Remove check for cm6enable flag after migration is complete
	 */
	private function shouldUseV6( OutputPage $out ): bool {
		return $this->useV6 || $out->getRequest()->getBool( 'cm6enable' ) ||
			$this->isBetaFeatureEnabled( $out->getUser() );
	}

	/**
	 * @param User $user
	 * @return bool
	 */
	private function isBetaFeatureEnabled( User $user ): bool {
		return ExtensionRegistry::getInstance()->isLoaded( 'BetaFeatures' ) &&
			BetaFeatures::isFeatureEnabled( $user, 'codemirror-beta-feature-enable' );
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
			$defaultPreferences['usecodemirror'] = [
				'type' => 'api',
			];

			// The following messages are generated upstream by the 'section' value
			// * prefs-accessibility
			$defaultPreferences['usecodemirror-colorblind'] = [
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
		$defaultPreferences['usecodemirror'] = [
			'type' => 'toggle',
			'label-message' => 'codemirror-prefs-enable',
			'section' => 'editing/syntax-highlighting',
		];

		$defaultPreferences['usecodemirror-colorblind'] = [
			'type' => 'toggle',
			'label-message' => 'codemirror-prefs-colorblind',
			'section' => 'editing/syntax-highlighting',
			'disable-if' => [ '!==', 'usecodemirror', '1' ]
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
		$betaPrefs[ 'codemirror-beta-feature-enable' ] = [
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
}
