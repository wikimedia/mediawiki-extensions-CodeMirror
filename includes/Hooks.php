<?php

namespace MediaWiki\Extension\CodeMirror;

use InvalidArgumentException;
use MediaWiki\Config\Config;
use MediaWiki\EditPage\EditPage;
use MediaWiki\Extension\Gadgets\GadgetRepo;
use MediaWiki\Hook\EditPage__showEditForm_initialHook;
use MediaWiki\Hook\EditPage__showReadOnlyForm_initialHook;
use MediaWiki\Output\OutputPage;
use MediaWiki\Preferences\Hook\GetPreferencesHook;
use MediaWiki\Registration\ExtensionRegistry;
use MediaWiki\ResourceLoader\Hook\ResourceLoaderGetConfigVarsHook;
use MediaWiki\User\Options\UserOptionsLookup;
use MediaWiki\User\User;

/**
 * @phpcs:disable MediaWiki.NamingConventions.LowerCamelFunctionsName.FunctionName
 */
class Hooks implements
	EditPage__showEditForm_initialHook,
	EditPage__showReadOnlyForm_initialHook,
	ResourceLoaderGetConfigVarsHook,
	GetPreferencesHook
{

	private UserOptionsLookup $userOptionsLookup;
	private array $conflictingGadgets;
	private bool $useV6;
	private ?GadgetRepo $gadgetRepo;

	/**
	 * @param UserOptionsLookup $userOptionsLookup
	 * @param Config $config
	 * @param GadgetRepo|null $gadgetRepo
	 */
	public function __construct(
		UserOptionsLookup $userOptionsLookup,
		Config $config,
		?GadgetRepo $gadgetRepo
	) {
		$this->userOptionsLookup = $userOptionsLookup;
		$this->useV6 = $config->get( 'CodeMirrorV6' );
		$this->conflictingGadgets = $config->get( 'CodeMirrorConflictingGadgets' );
		$this->gadgetRepo = $gadgetRepo;
	}

	/**
	 * Checks if CodeMirror for textarea wikitext editor should be loaded on this page or not.
	 *
	 * @param OutputPage $out
	 * @param ExtensionRegistry|null $extensionRegistry Overridden in tests.
	 * @return bool
	 */
	public function shouldLoadCodeMirror( OutputPage $out, ?ExtensionRegistry $extensionRegistry = null ): bool {
		// Disable CodeMirror when CodeEditor is active on this page
		// Depends on ext.codeEditor being added by \MediaWiki\EditPage\EditPage::showEditForm:initial
		if ( in_array( 'ext.codeEditor', $out->getModules(), true ) ) {
			return false;
		}

		$shouldUseV6 = $this->shouldUseV6( $out );
		$useCodeMirror = $this->userOptionsLookup->getBoolOption( $out->getUser(), 'usecodemirror' );
		$useWikiEditor = $this->userOptionsLookup->getBoolOption( $out->getUser(), 'usebetatoolbar' );
		// Disable CodeMirror 5 when the WikiEditor toolbar is not enabled in preferences.
		if ( !$shouldUseV6 && !$useWikiEditor ) {
			return false;
		}
		// In CodeMirror 6, either WikiEditor or the 'usecodemirror' preference must be enabled.
		if ( $shouldUseV6 && !$useWikiEditor && !$useCodeMirror ) {
			return false;
		}

		$extensionRegistry ??= ExtensionRegistry::getInstance();
		$contentModels = $extensionRegistry->getAttribute( 'CodeMirrorContentModels' );
		$isRTL = $out->getTitle()->getPageLanguage()->isRTL();
		// Disable CodeMirror if we're on an edit page with a conflicting gadget. See T178348.
		return !$this->conflictingGadgetsEnabled( $extensionRegistry, $out->getUser() ) &&
			// CodeMirror 5 on textarea wikitext editors doesn't support RTL (T170001)
			( !$isRTL || $this->shouldUseV6( $out ) ) &&
			// Limit to supported content models that use wikitext.
			// See https://www.mediawiki.org/wiki/Content_handlers#Extension_content_handlers
			in_array( $out->getTitle()->getContentModel(), $contentModels );
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
	 * Load CodeMirror if necessary.
	 *
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
			$out->addModules( $useWikiEditor ?
				'ext.CodeMirror.v6.WikiEditor.init' :
				'ext.CodeMirror.v6.init'
			);
		} else {
			$out->addModules( 'ext.CodeMirror.WikiEditor' );

			if ( $useCodeMirror ) {
				// These modules are predelivered for performance when needed
				// keep these modules in sync with ext.CodeMirror.js
				$out->addModules( [ 'ext.CodeMirror.lib', 'ext.CodeMirror.mode.mediawiki' ] );
			}
		}
	}

	/**
	 * Load CodeMirror 6 on read-only pages.
	 *
	 * @param EditPage $editor
	 * @param OutputPage $out
	 */
	public function onEditPage__showReadOnlyForm_initial( $editor, $out ): void {
		if ( $this->shouldUseV6( $out ) && $this->shouldLoadCodeMirror( $out ) ) {
			$useWikiEditor = $this->userOptionsLookup->getBoolOption( $out->getUser(), 'usebetatoolbar' );
			$out->addModules( $useWikiEditor ?
				'ext.CodeMirror.v6.WikiEditor.init' :
				'ext.CodeMirror.v6.init'
			);
		}
	}

	/**
	 * @param OutputPage $out
	 * @return bool
	 * @todo Remove check for cm6enable flag after migration is complete
	 */
	private function shouldUseV6( OutputPage $out ): bool {
		return $this->useV6 || $out->getRequest()->getRawVal( 'cm6enable' );
	}

	/**
	 * Hook handler for enabling bracket matching.
	 *
	 * TODO: Remove after migration to CodeMirror 6 is complete.
	 *
	 * @param array &$vars Array of variables to be added into the output of the startup module
	 * @param string $skin
	 * @param Config $config
	 * @return void This hook must not abort, it must return no value
	 */
	public function onResourceLoaderGetConfigVars( array &$vars, $skin, Config $config ): void {
		$vars['wgCodeMirrorLineNumberingNamespaces'] = $config->get( 'CodeMirrorLineNumberingNamespaces' );
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
		if ( !$this->useV6 ) {
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
			'label-message' => 'codemirror-v6-prefs-colorblind',
			'section' => 'editing/syntax-highlighting',
			'disable-if' => [ '!==', 'usecodemirror', '1' ]
		];
	}
}
