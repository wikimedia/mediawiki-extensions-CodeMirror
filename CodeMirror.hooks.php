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
		self::$globalVariableScript['FunctionSynonyms'] = $wgParser->mFunctionSynonyms;
		foreach ( MagicWord::getVariableIDs() as $name ) {
			if ( isset( $mw[$name] ) ) {
				$caseSensitive = array_shift( $mw[$name] ) == 0 ? 0 : 1;
				foreach ( $mw[$name] as $n ) {
					self::$globalVariableScript['FunctionSynonyms'][$caseSensitive][ $caseSensitive ? $n : $wgContLang->lc( $n ) ] = $name;
				}
			}
		}

		$output->addModules( 'ext.CodeMirror' );
		return true;
	}

	public static function onMakeGlobalVariablesScript( array &$vars ) {
		foreach ( self::$globalVariableScript as $key=> $value ) {
			$vars["extCodeMirror$key"] = $value;
		}
	}
}
