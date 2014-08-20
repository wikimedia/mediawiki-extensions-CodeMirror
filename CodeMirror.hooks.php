<?php


class CodeMirrorHooks {

	public static function onEditPageShowEditFormInitial( EditPage $editPage, OutputPage $output ) {
		$output->addModules( 'ext.CodeMirror' );
		return true;
	}

}
