<?php
/**
 * ResourceLoader callback for ext.CodeMirror.data module
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301, USA.
 * http://www.gnu.org/copyleft/gpl.html
 *
 * @file
 */

namespace MediaWiki\Extension\CodeMirror;

use MediaWiki\MediaWikiServices;
use MediaWiki\Registration\ExtensionRegistry;
use MediaWiki\ResourceLoader as RL;
use MediaWiki\ResourceLoader\ResourceLoader;

/**
 * ResourceLoader callback for ext.CodeMirror.data
 */
class DataScript {
	/**
	 * @param RL\Context $context
	 * @return string
	 */
	public static function makeScript( RL\Context $context ) {
		return ResourceLoader::makeConfigSetScript(
				[ 'extCodeMirrorConfig' => self::getFrontendConfiguraton() ]
			);
	}

	/**
	 * Returns an array of variables for CodeMirror to work (tags and so on)
	 *
	 * @return array
	 */
	private static function getFrontendConfiguraton() {
		// Use the content language, not the user language. (See T170130.)
		$lang = MediaWikiServices::getInstance()->getContentLanguage();
		$registry = ExtensionRegistry::getInstance();
		$parser = MediaWikiServices::getInstance()->getParser();
		$mwConfig = MediaWikiServices::getInstance()->getMainConfig();

		$tagModes = $registry->getAttribute( 'CodeMirrorTagModes' );
		$tagNames = array_merge( $parser->getTags(), array_keys( $tagModes ) );

		// initialize configuration
		$config = [
			'useV6' => $mwConfig->get( 'CodeMirrorV6' ),
			'lineNumberingNamespaces' => $mwConfig->get( 'CodeMirrorLineNumberingNamespaces' ),
			'templateFoldingNamespaces' => $mwConfig->get( 'CodeMirrorTemplateFoldingNamespaces' ),
			'pluginModules' => $registry->getAttribute( 'CodeMirrorPluginModules' ),
			'tagModes' => $tagModes,
			'tags' => array_fill_keys( $tagNames, true ),
			'doubleUnderscore' => [ [], [] ],
			'functionSynonyms' => $parser->getFunctionSynonyms(),
			'urlProtocols' => $parser->getUrlProtocols(),
			'linkTrailCharacters' => $lang->linkTrail(),
		];

		$mw = $lang->getMagicWords();
		$magicWordFactory = $parser->getMagicWordFactory();
		foreach ( $magicWordFactory->getDoubleUnderscoreArray()->getNames() as $name ) {
			if ( isset( $mw[$name] ) ) {
				$caseSensitive = array_shift( $mw[$name] ) == 0 ? 0 : 1;
				foreach ( $mw[$name] as $n ) {
					$n = $caseSensitive ? $n : $lang->lc( $n );
					$config['doubleUnderscore'][$caseSensitive][$n] = $name;
				}
			} else {
				$config['doubleUnderscore'][0][] = $name;
			}
		}

		foreach ( $magicWordFactory->getVariableIDs() as $name ) {
			if ( isset( $mw[$name] ) ) {
				$caseSensitive = array_shift( $mw[$name] ) == 0 ? 0 : 1;
				foreach ( $mw[$name] as $n ) {
					$n = $caseSensitive ? $n : $lang->lc( $n );
					$config['functionSynonyms'][$caseSensitive][$n] = $name;
				}
			}
		}

		return $config;
	}
}
