<?php

class CodeMirrorHooks {

	/**
	 * Checks if CodeMirror for textarea wikitext editor should be loaded on this page or not.
	 *
	 * @param IContextSource $context The current ContextSource object
	 * @return bool
	 */
	private static function isCodeMirrorOnPage( IContextSource $context ) {
		return in_array( Action::getActionName( $context ), [ 'edit', 'submit' ] ) &&
			// CodeMirror on textarea wikitext editors doesn't support RTL (T170001)
			!$context->getTitle()->getPageLanguage()->isRTL();
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
		if ( self::isCodeMirrorOnPage( $out->getContext() ) ) {
			$out->addModules( 'ext.CodeMirror' );
		}
		// TODO: for backwards compatibility. Remove in 2019.
		$out->addJsConfigVars( 'wgCodeMirrorEnabled', true );
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
	 * Register test modules for CodeMirror.
	 * @param array &$modules
	 * @param ResourceLoader &$rl
	 * @return bool
	 */
	public static function onResourceLoaderTestModules( array &$modules, ResourceLoader &$rl ) {
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

		return true;
	}

}
