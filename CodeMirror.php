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

const EXT_CODEMIRROR_VERSION = '3.1.2';

// Register this extension on Special:Version
$wgExtensionCredits['parserhook'][] = array(
	'path' => __FILE__,
	'name' => 'CodeMirror',
	'version' => EXT_CODEMIRROR_VERSION,
	'url' => 'https://www.mediawiki.org/wiki/Extension:CodeMirror',
	'author' => array( '[https://www.mediawiki.org/wiki/User:Pastakhov Pavel Astakhov]', 'Florian Schmidt' ),
	'descriptionmsg' => 'codemirror-desc'
);

// Allow translations for this extension
$wgMessagesDirs['CodeMirror'] = __DIR__ . '/i18n';
$wgExtensionMessagesFiles['CodeMirror'] = __DIR__ . '/CodeMirror.i18n.php';

$wgAutoloadClasses['CodeMirrorHooks'] = __DIR__ . '/CodeMirror.hooks.php';

$wgHooks['MakeGlobalVariablesScript'][] = 'CodeMirrorHooks::onMakeGlobalVariablesScript';
$wgHooks['BeforePageDisplay'][] = 'CodeMirrorHooks::onBeforePageDisplay';
$wgHooks['GetPreferences'][] = 'CodeMirrorHooks::onGetPreferences';
$wgHooks['ResourceLoaderRegisterModules'][] = 'CodeMirrorHooks::onResourceLoaderRegisterModules';

$wgCodeMirrorResourceTemplate = array(
	'localBasePath' => __DIR__ . '/resources',
	'remoteExtPath' => 'CodeMirror/resources',
);

$wgResourceModules['ext.CodeMirror.init'] = $wgCodeMirrorResourceTemplate + array(
	'dependencies' => array(
		'ext.CodeMirror.lib',
		'ext.CodeMirror.other',
		'mediawiki.api',
		'jquery.textSelection',
		'user.options',
	),
	'scripts' => array(
		'ext.CodeMirror.js'
	),
	'group' => 'ext.CodeMirror',
);

$wgResourceModules['ext.CodeMirror.lib'] = $wgCodeMirrorResourceTemplate + array(
	'scripts' => array(
		'lib/codemirror/lib/codemirror.js',
		'lib/codemirror/addon/selection/active-line.js',
		'mode/mediawiki/mediawiki.js',
	),
	'styles' => array(
		'lib/codemirror/lib/codemirror.css',
		'lib/codemirror/addon/lint/lint.css',
		'mode/mediawiki/mediawiki.css',
	),
	'group' => 'ext.CodeMirror',
	'targets' => array( 'mobile', 'desktop' ),
);

// Configuration options

/**
 * Specify, if CodeMirror extension should integrate CodeMirror in MediaWiki's editor (or WikiEditor), or if
 * it should work as a library provider for other extensions.
 */
$wgCodeMirrorEnableFrontend = true;
