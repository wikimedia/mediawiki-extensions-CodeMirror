<?php

namespace MediaWiki\Extension\CodeMirror;

use MediaWiki\Content\IContentHandlerFactory;
use MediaWiki\Extension\TemplateStyles\TemplateStylesContent;
use MediaWiki\Language\MessageLocalizer;
use MediaWiki\Linker\LinkTarget;

class SanitizedCssValidator extends BaseValidator {
	public function __construct(
		MessageLocalizer $localizer,
		private readonly IContentHandlerFactory $contentHandlerFactory,
	) {
		parent::__construct( $localizer );
	}

	public function validate( string $text, LinkTarget $title ): array {
		$contentHandler = $this->contentHandlerFactory->getContentHandler( 'sanitized-css' );
		'@phan-var \MediaWiki\Extension\TemplateStyles\TemplateStylesContentHandler $contentHandler';

		$content = new TemplateStylesContent( $text );
		$status = $contentHandler->sanitize( $content, [
			'novalue' => true,
		] );

		$errors = [];
		foreach ( $status->getMessages() as $error ) {

			// Special cases: errors added from TemplateStyles instead of css-sanitizer.
			// We don't have line and column numbers for them.
			if ( !str_starts_with( $error->getKey(), 'templatestyles-error-' ) ) {
				$errors[] = [
					'code' => $error->getKey(),
					'message' => $this->msg( $error )->plain(),
				];
				continue;
			}

			$code = preg_replace( '/^templatestyles-error-/', '', $error->getKey() );

			$errors[] = array_merge( [
				'code' => $code,
				'message' => $this->msg( $error )->plain(),
				'line' => $error->getParams()[0],
				'column' => $error->getParams()[1],
			], $this->getExtendedErrorData( $code, $error->getParams() ) );
		}

		return $errors;
	}

	/**
	 * Add error details as structured data if available. See i18n files for error descriptions, and/or
	 * https://gerrit.wikimedia.org/r/plugins/gitiles/css-sanitizer/+/refs/heads/master/errors.md
	 *
	 * @param string $code
	 * @param array $params
	 * @return array
	 */
	private function getExtendedErrorData( string $code, array $params ): array {
		switch ( $code ) {
			case 'bad-value-for-property':
			case 'missing-value-for-property':
				return [
					'property' => $params[2],
				];

			case 'at-rule-block-not-allowed':
			case 'at-rule-block-required':
			case 'expected-at-rule':
			case 'invalid-page-margin-at-rule':
			case 'invalid-font-feature-value':
				return [
					'at-rule' => $params[2],
				];
			default:
				return [];
		}
	}

}
