<?php

class CodeMirrorHooks {

	/**
	 * Checks if CodeMirror for textarea wikitext editor should be loaded on this page or not.
	 *
	 * @param OutputPage $out
	 * @return bool
	 */
	private static function isCodeMirrorOnPage( OutputPage $out ) {
		// Disable CodeMirror when CodeEditor is active on this page
		// Depends on ext.codeEditor being added by EditPage::showEditForm:initial
		if ( in_array( 'ext.codeEditor', $out->getModules() ) ) {
			return false;
		}
		$context = $out->getContext();
		return in_array( Action::getActionName( $context ), [ 'edit', 'submit' ] ) &&
			// CodeMirror on textarea wikitext editors doesn't support RTL (T170001)
			!$context->getTitle()->getPageLanguage()->isRTL();
	}

	/**
	 * BeforePageDisplay hook handler
	 *
	 * @see https://www.mediawiki.org/wiki/Manual:Hooks/BeforePageDisplay
	 *
	 * @param OutputPage $out
	 * @param Skin $skin
	 */
	public static function onBeforePageDisplay( OutputPage $out, Skin $skin ) {
		if ( self::isCodeMirrorOnPage( $out ) ) {
			$out->addModules( 'ext.CodeMirror' );

			if ( $out->getUser()->getOption( 'usecodemirror' ) ) {
				// These modules are predelivered for performance when needed
				// keep these modules in sync with ext.CodeMirror.js
				$out->addModules( [ 'ext.CodeMirror.lib', 'ext.CodeMirror.mode.mediawiki' ] );
			}
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
	public static function onGetPreferences( User $user, array &$defaultPreferences ) {
		// CodeMirror is enabled by default for users. It can
		// be changed by adding '$wgDefaultUserOptions['usecodemirror'] = 0;' into LocalSettings.php
		$defaultPreferences['usecodemirror'] = [
			'type' => 'api',
			'default' => '1',
		];
	}

	/**
	 * Register test modules for CodeMirror.
	 *
	 * @see https://www.mediawiki.org/wiki/Manual:Hooks/ResourceLoaderTestModules
	 *
	 * @param array &$modules
	 * @param ResourceLoader $rl
	 */
	public static function onResourceLoaderTestModules( array &$modules, ResourceLoader $rl ) {
		$modules['qunit']['ext.CodeMirror.test'] = [
			'scripts' => [
				'resources/mode/mediawiki/tests/qunit/CodeMirror.mediawiki.test.js',
			],
			'dependencies' => [
				'ext.CodeMirror.data',
				'ext.CodeMirror.lib',
				'ext.CodeMirror.mode.mediawiki',
			],
			'localBasePath' => __DIR__ . '/../',
			'remoteExtPath' => 'CodeMirror',
		];
	}

}
