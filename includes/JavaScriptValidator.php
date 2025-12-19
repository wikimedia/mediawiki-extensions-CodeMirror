<?php

namespace MediaWiki\Extension\CodeMirror;

use MediaWiki\Linker\LinkTarget;
use Peast\Peast;
use Peast\Syntax\Exception as PeastSyntaxException;

class JavaScriptValidator extends BaseValidator {

	public function validate( string $text, LinkTarget $title ): array {
		try {
			Peast::ES2017( $text )->parse();
			return [];

		} catch ( PeastSyntaxException $e ) {
			return [
				[
					'code' => 'syntax',
					'message' => $this->msg(
						'codemirror-validate-js-syntaxerror',
						$e->getPosition()->getColumn(),
						$e->getPosition()->getLine(),
						$e->getMessage()
					)->plain(),
					'line' => $e->getPosition()->getLine(),
					'column' => $e->getPosition()->getColumn(),
					'issue' => $e->getMessage(),
				]
			];
		}
	}
}
