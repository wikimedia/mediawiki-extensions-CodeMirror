<?php

namespace MediaWiki\Extension\CodeMirror\Tests;

use MediaWiki\Tests\Api\ApiTestCase;

/**
 * @covers \MediaWiki\Extension\CodeMirror\ApiCodeMirrorValidate
 */
class ApiCodeMirrorValidateTest extends ApiTestCase {

	/**
	 * @dataProvider provideInputs
	 */
	public function testCodeMirrorValidateAction( $contentModel, $content, $expectedResult ) {
		if ( $contentModel === 'Scribunto' ) {
			$this->markTestSkippedIfExtensionNotLoaded( 'Scribunto' );
		} elseif ( $contentModel === 'sanitized-css' ) {
			$this->markTestSkippedIfExtensionNotLoaded( 'TemplateStyles' );
		}

		$result = $this->doApiRequest( [
			'action' => 'codemirror-validate',
			'content' => $content,
			'contentmodel' => $contentModel,
			'title' => match ( $contentModel ) {
				'javascript' => 'MediaWiki:Foo.js',
				'sanitized-css' => 'Template:Foo/styles.css',
				'Scribunto' => 'Module:Foo',
			},
		] );

		if ( $expectedResult === true ) {
			$this->assertTrue( $result[0]['codemirror-validate']['valid'] );
		} else {
			$this->assertFalse( $result[0]['codemirror-validate']['valid'] );
			$this->assertSame( $expectedResult, $result[0]['codemirror-validate']['errors'] );
		}
	}

	public function provideInputs(): array {
		return [
			// Valid JavaScript
			[ 'javascript', 'let x = 4;', true ],

			// Invalid JavaScript
			[ 'javascript', 'let x =', [
				[
					'code' => 'syntax',
					'message' => 'Syntax error at column 7 on line 1: Unexpected end of input',
					'line' => 1,
					'column' => 7,
					'issue' => 'Unexpected end of input',
				] ]
			],

			// Valid Lua
			[ 'Scribunto', 'print("Hello, world!")', true ],

			// Invalid Lua
			[ 'Scribunto', 'print(', [
				[
					'code' => 'syntax',
					'message' => "Lua error at line 1: unexpected symbol near '<eof>'.",
					'line' => 1,
				] ]
			],

			// Valid sanitized-css
			[ 'sanitized-css', 'div { color: red; }', true ],

			// Invalid sanitized-css
			[ 'sanitized-css', 'div { color: } span { color: invalid; }', [
				[
					'code' => 'missing-value-for-property',
					'message' => 'Missing value for property <code>color</code> at line 1 character 7.',
					'line' => 1,
					'column' => 7,
					'property' => 'color',
				],
				[
					'code' => 'bad-value-for-property',
					'message' => 'Invalid or unsupported value for property <code>color</code> at line 1 character 30.',
					'line' => 1,
					'column' => 30,
					'property' => 'color',
				] ]
			],

			// Whitespace-only inputs should pass
			[ 'javascript', ' ', true ],
			[ 'sanitized-css', ' ', true ],
			[ 'Scribunto', ' ', true ],
		];
	}
}
