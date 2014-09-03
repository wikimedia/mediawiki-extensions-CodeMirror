<?php


class CodeMirrorHooks {

	static $globalVariableScript = array();

	/**
	 *
	 * @global Parser $wgParser
	 * @param EditPage $editPage
	 * @param OutputPage $output
	 * @return boolean
	 */
	public static function onEditPageShowEditFormInitial( EditPage $editPage, OutputPage $output ) {
		global $wgParser;
		if ( false === isset( $wgParser->mFunctionSynonyms ) ) {
			$wgParser->firstCallInit();
		}
		self::$globalVariableScript['FunctionSynonyms'] = $wgParser->mFunctionSynonyms;
		self::$globalVariableScript['Tags'] = $wgParser->getTags();
		$output->addModules( 'ext.CodeMirror' );
		return true;
	}

	public static function onMakeGlobalVariablesScript( array &$vars ) {
		foreach ( self::$globalVariableScript as $key=> $value ) {
			$vars["extCodeMirror$key"] = $value;
		}
	}
}
