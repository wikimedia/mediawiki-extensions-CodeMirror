<?php
/**
 * Main entry point for the CodeMirror extension.
 *
 * @link https://www.mediawiki.org/wiki/Extension:CodeMirror Documentation
 * @file CodeMirror.php
 * @defgroup CodeMirror
 * @ingroup Extensions
 * @author Pavel Astakhov <pastakhov@yandex.ru>
 * @licence GNU General Public Licence 2.0 or later
 */

// Check to see if we are being called as an extension or directly
if ( !defined( 'MEDIAWIKI' ) ) {
	die( 'This file is an extension to MediaWiki and thus not a valid entry point.' );
}

const EXT_CODEMIRROR_VERSION = '3.0.0';

// Register this extension on Special:Version
$wgExtensionCredits['parserhook'][] = array(
	'path' => __FILE__,
	'name' => 'CodeMirror',
	'version' => EXT_CODEMIRROR_VERSION,
	'url' => 'https://www.mediawiki.org/wiki/Extension:CodeMirror',
	'author' => '[https://www.mediawiki.org/wiki/User:Pastakhov Pavel Astakhov]',
	'descriptionmsg' => 'codemirror-desc'
);

// Allow translations for this extension
$wgMessagesDirs['CodeMirror'] = __DIR__ . '/i18n';
$wgExtensionMessagesFiles['CodeMirror'] = __DIR__ . '/CodeMirror.i18n.php';

$wgAutoloadClasses['CodeMirrorHooks'] = __DIR__ . '/CodeMirror.hooks.php';

$wgHooks['EditPage::showEditForm:initial'][] = 'CodeMirrorHooks::onEditPageShowEditFormInitial';
//$wgHooks['EditPage::showReadOnlyForm:initial'][] = 'CodeMirrorHooks::onEditPageShowEditFormInitial';
$wgHooks['MakeGlobalVariablesScript'][] = 'CodeMirrorHooks::onMakeGlobalVariablesScript';
$wgHooks['GetPreferences'][] = 'CodeMirrorHooks::getPreferences';

$wgHooks['ResourceLoaderRegisterModules'][] = function () {
	global $wgResourceModules, $wgCodeMirrorResources;
	if ( isset($wgResourceModules['ext.wikiEditor']) ) {
		$wgCodeMirrorResources['dependencies']['ext.wikiEditor'] = true;
	}
	if ( isset( $wgCodeMirrorResources['scripts'] ) ) {
		$wgResourceModules['ext.CodeMirror.other']['scripts'] = array_keys( $wgCodeMirrorResources['scripts'] );
	}
	if ( isset( $wgCodeMirrorResources['styles'] ) ) {
		$wgResourceModules['ext.CodeMirror.other']['styles'] = array_keys( $wgCodeMirrorResources['styles'] );
	}
	if ( isset( $wgCodeMirrorResources['messages'] ) ) {
		$wgResourceModules['ext.CodeMirror.other']['messages'] = array_keys( $wgCodeMirrorResources['messages'] );
	}
	if ( isset( $wgCodeMirrorResources['dependencies'] ) ) {
		$wgResourceModules['ext.CodeMirror.other']['dependencies'] = array_keys( $wgCodeMirrorResources['dependencies'] );
	}
};

$tpl = array(
	'localBasePath' => __DIR__ . '/resources',
	'remoteExtPath' => 'CodeMirror/resources',
);
$wgResourceModules['ext.CodeMirror.init'] = array(
	'group' => 'ext.CodeMirror',
	'scripts' => 'ext.CodeMirror.js',
	'dependencies' => array( 'ext.CodeMirror.lib', 'ext.CodeMirror.other' ),
) + $tpl;

$wgResourceModules['ext.CodeMirror.lib'] = array(
	'group' => 'ext.CodeMirror',
	'scripts' => array(
		'lib/codemirror/lib/codemirror.js',
		'lib/codemirror/addon/selection/active-line.js',
		'mode/mediawiki/mediawiki.js',
		//'mode/mediawiki/matchMW.js',
	),
	'styles' => array(
		'lib/codemirror/lib/codemirror.css',
		'lib/codemirror/addon/lint/lint.css',
		'mode/mediawiki/mediawiki.css',
	),
) + $tpl;

$wgResourceModules['ext.CodeMirror.other'] = array(
	'group' => 'ext.CodeMirror',
) + $tpl;

$wgCodeMirrorResources = array(
	'dependencies' => array( 'ext.CodeMirror.lib' => true ),
);
