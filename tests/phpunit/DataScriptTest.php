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
		$this->assertStringContainsString( '"templateFoldingNamespaces":', $script );
		$this->assertStringContainsString( '"pluginModules":', $script );
		$this->assertStringContainsString( '"tagModes":', $script );
		$this->assertStringContainsString( '"tags":', $script );
		$this->assertStringContainsString( '"doubleUnderscore":', $script );
		$this->assertStringContainsString( '"functionSynonyms":', $script );
		$this->assertStringContainsString( '"urlProtocols":', $script );
		$this->assertStringContainsString( '"linkTrailCharacters":', $script );
	}

}
