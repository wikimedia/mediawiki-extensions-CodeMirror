<?php

namespace MediaWiki\Extension\CodeMirror;

use MediaWiki\Extension\Scribunto\EngineFactory;
use MediaWiki\Extension\Scribunto\Engines\LuaCommon\LuaEngine;
use MediaWiki\Extension\Scribunto\Engines\LuaCommon\LuaModule;
use MediaWiki\Extension\Scribunto\ScribuntoException;
use MediaWiki\Linker\LinkTarget;
use MediaWiki\Title\Title;
use MessageLocalizer;

class ScribuntoValidator extends BaseValidator {

	public function __construct(
		MessageLocalizer $localizer,
		private readonly EngineFactory $engineFactory,
	) {
		parent::__construct( $localizer );
	}

	public function validate( string $text, LinkTarget $title ): array {
		$title = Title::newFromLinkTarget( $title );

		/** @var LuaEngine $engine */
		$engine = $this->engineFactory->getDefaultEngine( [ 'title' => $title ] );
		'@phan-var LuaEngine $engine';
		$module = new LuaModule( $engine, $text, $title->getPrefixedText() );

		try {
			$module->getInitChunk();
			return [];
		} catch ( ScribuntoException $e ) {
			$error = [
				'code' => 'syntax',
				'message' => $this->msg( $e->messageName, ...$e->messageArgs )->plain(),
			];
			if ( isset( $e->params['line'] ) ) {
				// @phan-suppress-next-line PhanTypePossiblyInvalidDimOffset
				$error['line'] = (int)$e->params['line'];
			}
			return [ $error ];
		}
	}
}
