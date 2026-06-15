<?php

namespace MediaWiki\Extension\CodeMirror\Tests;

use MediaWiki\Extension\CodeMirror\JavaScriptValidator;
use MediaWiki\Language\MessageLocalizer;
use MediaWiki\ResourceLoader\WikiModule;
use MediaWiki\Title\Title;
use MediaWikiIntegrationTestCase;

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
	public function testRequiresValidation( $ns, $pageName, $expected ) {
		$this->assertEquals( $expected, $this->validator->requiresValidation( Title::makeTitle( $ns, $pageName ) ) );
	}

	public static function provideTitles() {
		return [
			[ NS_MEDIAWIKI, 'Common.js', true ],
			[ NS_MEDIAWIKI, 'Group-sysop.js', true ],
			[ NS_USER, 'Example/common.js', true ],
			[ NS_USER, 'Example/vector.js', true ],
			[ NS_PROJECT, 'Script.js', false ],
			[ NS_MEDIAWIKI, 'Test.js', true ],
		];
	}
}
