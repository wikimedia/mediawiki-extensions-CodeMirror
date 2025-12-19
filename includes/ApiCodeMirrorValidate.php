<?php

namespace MediaWiki\Extension\CodeMirror;

use MediaWiki\Api\ApiBase;
use MediaWiki\Api\ApiMain;
use MediaWiki\Api\ApiResult;
use MediaWiki\Content\IContentHandlerFactory;
use MediaWiki\ParamValidator\TypeDef\TitleDef;
use Wikimedia\ObjectFactory\ObjectFactory;
use Wikimedia\ParamValidator\ParamValidator;

/**
 * API module to check for validation errors in the given content.
 */
class ApiCodeMirrorValidate extends ApiBase {

	public const VALIDATOR_SPECS = [
		'javascript' => [
			'class' => JavaScriptValidator::class,
		],
		'sanitized-css' => [
			'class' => SanitizedCssValidator::class,
			'services' => [ 'ContentHandlerFactory' ],
		],
		'Scribunto' => [
			'class' => ScribuntoValidator::class,
			// Only instantiated if Scribunto is installed, so Scribunto.EngineFactory
			// can be listed under `services` instead of `optional_services`.
			'services' => [ 'Scribunto.EngineFactory' ],
		],
	];

	/** @var array<string, BaseValidator> */
	private array $validators = [];

	public function __construct(
		ApiMain $main,
		string $action,
		private readonly IContentHandlerFactory $contentHandlerFactory,
		private readonly ObjectFactory $objectFactory,
	) {
		parent::__construct( $main, $action );

		foreach ( self::VALIDATOR_SPECS as $model => $spec ) {
			if ( $this->contentHandlerFactory->isDefinedModel( $model ) ) {
				// ObjectFactory::createObject accepts an array, not just a callable (phan bug)
				// @phan-suppress-next-line PhanTypeInvalidCallableArrayKey
				$this->validators[$model] = $this->objectFactory->createObject( $spec, [
					'extraArgs' => [
						$this->getContext(),
					],
					'assertClass' => BaseValidator::class,
				] );
			}
		}
	}

	public function execute() {
		$params = $this->extractRequestParams();
		$text = $params['content'];
		$model = $params['contentmodel'];

		$validator = $this->validators[$model];

		$errors = $validator->validate( $text, $params['title'] );
		$this->getResult()->addValue( $this->getModuleName(), 'valid', count( $errors ) === 0 );
		if ( $errors ) {
			ApiResult::setIndexedTagName( $errors, 'error' );
			$this->getResult()->addValue( $this->getModuleName(), 'errors', $errors );
		}
	}

	/** @inheritDoc */
	public function isInternal() {
		return true;
	}

	/** @inheritDoc */
	public function getAllowedParams() {
		return [
			'content' => [
				ParamValidator::PARAM_TYPE => 'text',
				ParamValidator::PARAM_REQUIRED => true,
			],
			'contentmodel' => [
				ParamValidator::PARAM_TYPE => array_keys( $this->validators ),
				ParamValidator::PARAM_REQUIRED => true,
			],
			'title' => [
				ParamValidator::PARAM_TYPE => 'title',
				ParamValidator::PARAM_REQUIRED => true,
				TitleDef::PARAM_RETURN_OBJECT => true,
			],
		];
	}

	/** @inheritDoc */
	protected function getExamplesMessages() {
		return [
			'action=codemirror-validate&contentmodel=sanitized-css&content=h2 {color: red}&title=Template:X1/styles.css'
				=> 'apihelp-codemirror-validate-example',
		];
	}

}
