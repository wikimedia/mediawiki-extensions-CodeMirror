<?php

namespace MediaWiki\Extension\CodeMirror;

use MediaWiki\Language\MessageLocalizer;
use MediaWiki\Linker\LinkTarget;

abstract class BaseValidator implements MessageLocalizer {

	public function __construct(
		private readonly MessageLocalizer $localizer,
	) {
	}

	/**
	 * Get the validation errors for the given text.
	 * @param string $text
	 * @param LinkTarget $title
	 * @return array
	 */
	abstract public function validate( string $text, LinkTarget $title ): array;

	/** @inheritDoc */
	public function msg( $key, ...$params ) {
		return $this->localizer->msg( $key, ...$params );
	}
}
