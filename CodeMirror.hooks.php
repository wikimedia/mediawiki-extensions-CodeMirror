<?php


class CodeMirrorHooks {

	static $globalVariableScript = array();

	/**
	 *
	 * @global Parser $wgParser
	 * @global Language $wgContLang
	 * @param EditPage $editPage
	 * @param OutputPage $output
	 * @return boolean
	 */
	public static function onEditPageShowEditFormInitial( EditPage $editPage, OutputPage $output ) {
		global $wgParser, $wgContLang;
		if ( false === isset( $wgParser->mFunctionSynonyms ) ) {
			$wgParser->initialiseVariables();
			$wgParser->firstCallInit();
		}
		self::$globalVariableScript['Tags'] = $wgParser->getTags();

		$mw = $wgContLang->getMagicWords();
		self::$globalVariableScript['DoubleUnderscore'] = array( array(), array() );
		foreach ( MagicWord::getDoubleUnderscoreArray()->names as $name ) {
			if ( isset( $mw[$name] ) ) {
				$caseSensitive = array_shift( $mw[$name] ) == 0 ? 0 : 1;
				foreach ( $mw[$name] as $n ) {
					self::$globalVariableScript['DoubleUnderscore'][$caseSensitive][ $caseSensitive ? $n : $wgContLang->lc( $n ) ] = $name;
				}
			} else {
				self::$globalVariableScript['DoubleUnderscore'][0][] = $name;
			}
		}

		self::$globalVariableScript['FunctionSynonyms'] = $wgParser->mFunctionSynonyms;
		foreach ( MagicWord::getVariableIDs() as $name ) {
			if ( isset( $mw[$name] ) ) {
				$caseSensitive = array_shift( $mw[$name] ) == 0 ? 0 : 1;
				foreach ( $mw[$name] as $n ) {
					self::$globalVariableScript['FunctionSynonyms'][$caseSensitive][ $caseSensitive ? $n : $wgContLang->lc( $n ) ] = $name;
				}
			}
		}

		self::$globalVariableScript['UrlProtocols'] = $wgParser->mUrlProtocols;// wfUrlProtocolsWithoutProtRel();
//		self::$globalVariableScript['LinkTrailCharacters'] = $wgContLang->linkTrail();
		$output->addModules( 'ext.CodeMirror' );
		return true;
	}

	public static function onMakeGlobalVariablesScript( array &$vars ) {
		foreach ( self::$globalVariableScript as $key=> $value ) {
			$vars["extCodeMirror$key"] = $value;
		}
	}
}
