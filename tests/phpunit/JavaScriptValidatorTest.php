<?php

namespace MediaWiki\Extension\CodeMirror\Tests;

use MediaWiki\Extension\CodeMirror\JavaScriptValidator;
use MediaWiki\ResourceLoader\WikiModule;
use MediaWiki\Title\Title;
use MediaWikiIntegrationTestCase;
use MessageLocalizer;

/**
 * @covers \MediaWiki\Extension\CodeMirror\JavaScriptValidator
 * @group Database
 */
class JavaScriptValidatorTest extends MediaWikiIntegrationTestCase {
	private JavaScriptValidator $validator;

	public function setUp(): void {
		$this->validator = new JavaScriptValidator(
			$this->createMock( MessageLocalizer::class ),
			$this->getServiceContainer()->getResourceLoader(),
			$this->getServiceContainer()->getMainWANObjectCache(),
			$this->getServiceContainer()->getSkinFactory(),
			$this->getServiceContainer()->getUserGroupManager()
		);

		$this->getServiceContainer()->getResourceLoader()->register( [
			'test-wiki-module' => [
				'class' => WikiModule::class,
				'scripts' => [
					'MediaWiki:Test.js',
				]
			]
		] );
	}

	/**
	 * @dataProvider provideTitles
	 */
	public function testRequiresValidation( $pageName, $expected ) {
		$this->assertEquals( $expected, $this->validator->requiresValidation( Title::newFromText( $pageName ) ) );
	}

	public function provideTitles() {
		return [
			[ 'MediaWiki:Common.js', true ],
			[ 'MediaWiki:Group-sysop.js', true ],
			[ 'User:Example/common.js', true ],
			[ 'User:Example/vector.js', true ],
			[ 'Project:Script.js', false ],
			[ 'MediaWiki:Test.js', true ],
		];
	}
}
