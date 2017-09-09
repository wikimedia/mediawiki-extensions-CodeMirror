<?php

class CodeMirrorHooks {

	/**
	 * Checks, if CodeMirror should be loaded on this page or not.
	 *
	 * @param IContextSource $context The current ContextSource object
	 * @staticvar null|boolean $isEnabled Saves, if CodeMirror should be loaded on this page or not
	 * @return bool
	 */
	private static function isCodeMirrorEnabled( IContextSource $context ) {
		global $wgCodeMirrorBetaFeature;
		static $isEnabled = null;

		// Check, if we already checked, if page action is editing, if not, do it now
		if ( $isEnabled === null ) {
			if ( !$wgCodeMirrorBetaFeature ) {
				$isEnabled = in_array( Action::getActionName( $context ), [ 'edit', 'submit' ] );
			} else {
				$isEnabled = in_array( Action::getActionName( $context ), [ 'edit', 'submit' ] ) &&
					$wgCodeMirrorBetaFeature &&
					ExtensionRegistry::getInstance()->isLoaded( 'BetaFeatures' ) &&
					BetaFeatures::isFeatureEnabled(
						$context->getUser(), 'codemirror-syntax-highlight' );
			}
		}

		return $isEnabled;
	}

	/**
	 * BeforePageDisplay hook handler
	 *
	 * @see https://www.mediawiki.org/wiki/Manual:Hooks/BeforePageDisplay
	 *
	 * @param OutputPage &$out
	 * @param Skin &$skin
	 */
	public static function onBeforePageDisplay( OutputPage &$out, Skin &$skin ) {
		if ( self::isCodeMirrorEnabled( $out->getContext() ) ) {
			$out->addModules( 'ext.CodeMirror' );
		}
	}

	/**
	 * GetPreferences hook handler
	 *
	 * @see https://www.mediawiki.org/wiki/Manual:Hooks/GetPreferences
	 *
	 * @param User $user
	 * @param array &$defaultPreferences
	 */
	public static function onGetPreferences( User $user, &$defaultPreferences ) {
		// CodeMirror is enabled by default for users. It can
		// be changed by adding '$wgDefaultUserOptions['usecodemirror'] = 0;' into LocalSettings.php
		$defaultPreferences['usecodemirror'] = [
			'type' => 'api',
			'default' => '1',
		];
	}

	/**
	 * GetBetaFeaturePreferences hook handler
	 *
	 * @param User $user
	 * @param array &$preferences
	 */
	public static function onGetBetaFeaturePreferences( User $user, &$preferences ) {
		global $wgCodeMirrorBetaFeature, $wgExtensionAssetsPath;
		if ( $wgCodeMirrorBetaFeature ) {
			$preferences['codemirror-syntax-highlight'] = [
				'label-message' => 'codemirror-beta-title',
				'desc-message' => 'codemirror-beta-desc',
				'screenshot' => [
					'ltr' => $wgExtensionAssetsPath . '/CodeMirror/resources/images/codemirror-beta-ltr.svg',
					'rtl' => $wgExtensionAssetsPath . '/CodeMirror/resources/images/codemirror-beta-rtl.svg'
				],
				'info-link' => 'https://meta.wikimedia.org/wiki/Special:MyLanguage/' .
					'Community_Tech/Wikitext_editor_syntax_highlighting',
				'discussion-link' => 'https://www.mediawiki.org/wiki/' .
					'Extension_talk:CodeMirror'
			];
		}
	}

}
