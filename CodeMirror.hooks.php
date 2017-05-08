<?php

class CodeMirrorHooks {

	/**
	 * Checks, if CodeMirror should be loaded on this page or not.
	 *
	 * @param IContextSource $context The current ContextSource object
	 * @global bool $wgCodeMirrorEnableFrontend Should CodeMirror be loaded on this page
	 * @staticvar null|boolean $isEnabled Saves, if CodeMirror should be loaded on this page or not
	 * @return bool
	 */
	private static function isCodeMirrorEnabled( IContextSource $context ) {
		global $wgCodeMirrorEnableFrontend;
		static $isEnabled = null;

		// Check, if we already checked, if page action is editing, if not, do it now
		if ( $isEnabled === null ) {
			$isEnabled = $wgCodeMirrorEnableFrontend &&
				in_array(
					Action::getActionName( $context ),
					[ 'edit', 'submit' ]
				);
		}

		return $isEnabled;
	}

	/**
	 * This function are used by the MobileFrontend extension only and will be
	 * removed
	 * @deprecated since version 4.0.0
	 * @todo Remove usage in MobileFrontend and this function some time later
	 * @param IContextSource $context
	 * @return array
	 */
	public static function getGlobalVariables() {
		MWDebug::deprecated( __METHOD__ );
		return [];
	}

	/**
	 * Returns an array of variables for CodeMirror to work (tags and so on)
	 *
	 * @param IContextSource $context The current ContextSource object
	 * @global Parser $wgParser
	 * @staticvar array $config Cached version of configuration
	 * @return array
	 */
	public static function getConfiguraton( IContextSource $context ) {
		global $wgParser;
		static $config = [];

		// if we already created these variable array, return it
		if ( !$config ) {
			$contObj = $context->getLanguage();

			if ( !isset( $wgParser->mFunctionSynonyms ) ) {
				$wgParser->initialiseVariables();
				$wgParser->firstCallInit();
			}

			// initialize configuration
			$config = [
				'pluginModules' => ExtensionRegistry::getInstance()->getAttribute( 'CodeMirrorPluginModules' ),
				'tagModes' => ExtensionRegistry::getInstance()->getAttribute( 'CodeMirrorTagModes' ),
				'tags' => array_fill_keys( $wgParser->getTags(), true ),
				'doubleUnderscore' => [ [], [] ],
				'functionSynonyms' => $wgParser->mFunctionSynonyms,
				'urlProtocols' => $wgParser->mUrlProtocols,
				'linkTrailCharacters' =>  $contObj->linkTrail(),
			];

			$mw = $contObj->getMagicWords();
			foreach ( MagicWord::getDoubleUnderscoreArray()->names as $name ) {
				if ( isset( $mw[$name] ) ) {
					$caseSensitive = array_shift( $mw[$name] ) == 0 ? 0 : 1;
					foreach ( $mw[$name] as $n ) {
						$config['doubleUnderscore'][$caseSensitive][ $caseSensitive ? $n : $contObj->lc( $n ) ] = $name;
					}
				} else {
					$config['doubleUnderscore'][0][] = $name;
				}
			}

			foreach ( MagicWord::getVariableIDs() as $name ) {
				if ( isset( $mw[$name] ) ) {
					$caseSensitive = array_shift( $mw[$name] ) == 0 ? 0 : 1;
					foreach ( $mw[$name] as $n ) {
						$config['functionSynonyms'][$caseSensitive][ $caseSensitive ? $n : $contObj->lc( $n ) ] = $name;
					}
				}
			}

		}

		return $config;
	}

	/**
	 * MakeGlobalVariablesScript hook handler
	 *
	 * @see https://www.mediawiki.org/wiki/Manual:Hooks/MakeGlobalVariablesScript
	 *
	 * @param array $vars
	 * @param OutputPage $out
	 */
	public static function onMakeGlobalVariablesScript( array &$vars, OutputPage $out ) {
		$context = $out->getContext();
		// add CodeMirror vars on edit pages, or if VE is installed
		if ( self::isCodeMirrorEnabled( $context ) || class_exists( 'VisualEditorHooks' )  ) {
			$vars['extCodeMirrorConfig'] = self::getConfiguraton( $context );
		}
	}

	/**
	 * BeforePageDisplay hook handler
	 *
	 * @see https://www.mediawiki.org/wiki/Manual:Hooks/BeforePageDisplay
	 *
	 * @param OutputPage $out
	 * @param Skin $skin
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
	 * @param array $defaultPreferences
	 */
	public static function onGetPreferences( User $user, &$defaultPreferences ) {
		// CodeMirror is enabled by default for users.
		// It can be changed by adding '$wgDefaultUserOptions['usecodemirror'] = 0;' into LocalSettings.php
		$defaultPreferences['usecodemirror'] = [
			'type' => 'api',
			'default' => '1',
		];
	}

}
