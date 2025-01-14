<?php

namespace MediaWiki\Extension\CodeMirror\Tests;

use MediaWiki\Extension\CodeMirror\DataScript;
use MediaWiki\ResourceLoader\Context;

/**
 * @covers \MediaWiki\Extension\CodeMirror\DataScript
 */
class DataScriptTest extends \MediaWikiIntegrationTestCase {

	public function testMakeScript() {
		$context = $this->createMock( Context::class );

		$script = DataScript::makeScript( $context );
		$this->assertStringContainsString( '"extCodeMirrorConfig":', $script );
		$this->assertStringContainsString( '"lineNumberingNamespaces":', $script );
		$this->assertStringContainsString( '"codeFoldingNamespaces":', $script );
		$this->assertStringContainsString( '"autocompleteNamespaces":', $script );
		$this->assertStringContainsString( '"openLinksNamespaces":', $script );
		$this->assertStringContainsString( '"pluginModules":', $script );
		$this->assertStringContainsString( '"tagModes":', $script );
		$this->assertStringContainsString( '"tags":', $script );
		$this->assertStringContainsString( '"doubleUnderscore":', $script );
		$this->assertStringContainsString( '"functionSynonyms":', $script );
		$this->assertStringContainsString( '"variableIDs"', $script );
		$this->assertStringContainsString( '"urlProtocols":', $script );
		$this->assertStringContainsString( '"linkTrailCharacters":', $script );
	}

}
