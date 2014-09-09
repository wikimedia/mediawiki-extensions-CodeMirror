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

const EXT_CODEMIRROR_VERSION = '2.1.0';

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
$wgHooks['EditPage::showReadOnlyForm:initial'][] = 'CodeMirrorHooks::onEditPageShowEditFormInitial';
$wgHooks['MakeGlobalVariablesScript'][] = 'CodeMirrorHooks::onMakeGlobalVariablesScript';

$tpl = array(
	'localBasePath' => __DIR__ . '/resources',
	'remoteExtPath' => 'CodeMirror/resources',
);

$wgResourceModules['ext.CodeMirror'] = array(
	'scripts' => 'ext.CodeMirror.js',
	'dependencies' => 'ext.CodeMirror.lib',
) + $tpl;

$wgResourceModules['ext.CodeMirror.lib'] = array(
	'group' => 'ext.CodeMirror.lib',
	'scripts' => array(
		'lib/codemirror/lib/codemirror.js',
		'lib/codemirror/addon/selection/active-line.js',
		//'lib/codemirror/edit/matchbrackets.js',
		//'lib/codemirror/edit/closebrackets.js',
		'mode/mediawiki/mediawiki.js',
	),
	'styles' => array(
		'lib/codemirror/lib/codemirror.css',
		'mode/mediawiki/mediawiki.css',
	),
) + $tpl;
