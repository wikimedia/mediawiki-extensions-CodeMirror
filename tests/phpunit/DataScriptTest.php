<?php

namespace MediaWiki\Extension\CodeMirror\Tests;

use MediaWiki\Extension\CodeMirror\DataScript;
use MediaWiki\Request\FauxRequest;
use MediaWiki\ResourceLoader\Context;
use MediaWiki\ResourceLoader\ResourceLoader;

/**
 * @covers \MediaWiki\Extension\CodeMirror\DataScript
 */
class DataScriptTest extends \MediaWikiIntegrationTestCase {

	public function testMakeScript() {
		$context = new Context( $this->createMock( ResourceLoader::class ), new FauxRequest() );
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
		$this->assertStringContainsString( '"urlProtocols":', $script );
		$this->assertStringContainsString( '"linkTrailCharacters":', $script );
	}

}
