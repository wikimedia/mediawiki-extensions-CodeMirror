<?php

namespace MediaWiki\Extension\CodeMirror;

use Action;
use Config;
use MediaWiki\MediaWikiServices;
use OutputPage;
use RequestContext;
use Skin;
use User;

class Hooks {

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
		$userOptionsLookup = MediaWikiServices::getInstance()->getUserOptionsLookup();
		// Disable CodeMirror when the WikiEditor toolbar is not enabled in preferences
		if ( !$userOptionsLookup->getOption( $out->getUser(), 'usebetatoolbar' ) ) {
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

			$userOptionsLookup = MediaWikiServices::getInstance()->getUserOptionsLookup();
			if ( $userOptionsLookup->getOption( $out->getUser(), 'usecodemirror' ) ) {
				// These modules are predelivered for performance when needed
				// keep these modules in sync with ext.CodeMirror.js
				$out->addModules( [ 'ext.CodeMirror.lib', 'ext.CodeMirror.mode.mediawiki' ] );
			}
		}
	}

	/**
	 * Hook handler for enabling bracket matching.
	 *
	 * TODO: restrict to pages where codemirror might be enabled.
	 *
	 * @param array &$vars Array of variables to be added into the output of the startup module
	 */
	public static function onResourceLoaderGetConfigVars( array &$vars ) {
		/** @var Config $config */
		$config = MediaWikiServices::getInstance()->getMainConfig();

		$vars['wgCodeMirrorEnableBracketMatching'] = $config->get( 'CodeMirrorEnableBracketMatching' )
			// Allows tests to override the configuration.
			|| RequestContext::getMain()->getRequest()
				->getCookie( '-codemirror-bracket-matching-test', 'mw' );

		$vars['wgCodeMirrorAccessibilityColors'] = $config->get( 'CodeMirrorAccessibilityColors' );

		$vars['wgCodeMirrorLineNumberingNamespaces'] = $config->get( 'CodeMirrorLineNumberingNamespaces' );
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
		// CodeMirror is disabled by default for all users. It can enabled for everyone
		// by default by adding '$wgDefaultUserOptions['usecodemirror'] = 1;' into LocalSettings.php
		$defaultPreferences['usecodemirror'] = [
			'type' => 'api',
		];
	}

}
