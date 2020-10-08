<?php

namespace CodeMirror\Tests;

use ResourceLoaderCodeMirrorModule;
use ResourceLoaderContext;

/**
 * @covers \ResourceLoaderCodeMirrorModule
 */
class ResourceLoaderCodeMirrorModuleTest extends \MediaWikiIntegrationTestCase {

	public function testResourceLoaderModule() {
		$context = $this->createMock( ResourceLoaderContext::class );
		$module = new ResourceLoaderCodeMirrorModule();

		$this->assertFalse( $module->supportsURLLoading() );
		$this->assertTrue( $module->enableModuleContentVersion() );

		$script = $module->getScript( $context );
		$this->assertStringContainsString( '"extCodeMirrorConfig":', $script );
		$this->assertStringContainsString( '"pluginModules":', $script );
		$this->assertStringContainsString( '"tagModes":', $script );
		$this->assertStringContainsString( '"tags":', $script );
		$this->assertStringContainsString( '"doubleUnderscore":', $script );
		$this->assertStringContainsString( '"functionSynonyms":', $script );
		$this->assertStringContainsString( '"urlProtocols":', $script );
		$this->assertStringContainsString( '"linkTrailCharacters":', $script );
	}

}
