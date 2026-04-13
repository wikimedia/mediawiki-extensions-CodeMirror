<?php

namespace MediaWiki\Extension\CodeMirror;

use MediaWiki\Context\RequestContext;
use MediaWiki\Language\MessageLocalizer;
use MediaWiki\Linker\LinkTarget;
use MediaWiki\ResourceLoader as RL;
use MediaWiki\Skin\SkinFactory;
use MediaWiki\Title\Title;
use MediaWiki\User\UserGroupManager;
use Peast\Peast;
use Peast\Syntax\Exception as PeastSyntaxException;
use Wikimedia\ObjectCache\WANObjectCache;

class JavaScriptValidator extends BaseValidator {

	public const PAGES_CACHE_KEY = 'codemirror-js-pagelist';

	public function __construct(
		MessageLocalizer $localizer,
		private readonly RL\ResourceLoader $resourceLoader,
		private readonly WANObjectCache $wanCache,
		private readonly SkinFactory $skinFactory,
		private readonly UserGroupManager $userGroupManager,
	) {
		parent::__construct( $localizer );
	}

	public function validate( string $text, LinkTarget $title ): array {
		if ( !$this->requiresValidation( Title::newFromLinkTarget( $title ) ) ) {
			return [];
		}

		try {
			Peast::ES2017( $text )->parse();
			return [];

		} catch ( PeastSyntaxException $e ) {
			return [
				[
					'code' => 'syntax',
					'message' => $this->msg(
						'codemirror-validate-js-syntaxerror',
						$e->getPosition()->getColumn(),
						$e->getPosition()->getLine(),
						$e->getMessage()
					)->plain(),
					'line' => $e->getPosition()->getLine(),
					'column' => $e->getPosition()->getColumn(),
					'issue' => $e->getMessage(),
				]
			];
		}
	}

	/**
	 * Check if the given JS page is part of any ResourceLoader module (and hence requires validation).
	 * @param Title $title
	 * @return bool
	 */
	public function requiresValidation( Title $title ): bool {
		// Special case: the 'user' module, where the pages are different for different users
		if ( $title->inNamespace( NS_MEDIAWIKI ) ) {
			if ( in_array( $title->getText(),
				array_map( static fn ( $group ) => "Group-$group.js", $this->userGroupManager->listAllGroups() ) ) ) {
				return true;
			}
		} elseif ( $title->inNamespace( NS_USER ) ) {
			if ( $title->getFullSubpageText() === 'common.js' ) {
				return true;
			}
			if ( in_array( $title->getFullSubpageText(),
				array_map( static fn ( $skin ) => "$skin.js", $this->skinFactory->getAllowedSkins() ) ) ) {
				return true;
			}
		}

		$pagesToValidate = $this->wanCache->getWithSetCallback(
			self::PAGES_CACHE_KEY,
			$this->wanCache::TTL_HOUR,
			$this->fetchPagesRequiringValidation( ... ),
		);

		return in_array( $title->getDBkey(), $pagesToValidate[$title->getNamespace()] ?? [], true );
	}

	private function fetchPagesRequiringValidation(): array {
		$pages = [];

		$rlContext = new RL\Context( $this->resourceLoader, RequestContext::getMain()->getRequest() );
		$moduleNames = $this->resourceLoader->getModuleNames();

		foreach ( $moduleNames as $moduleName ) {
			$module = $this->resourceLoader->getModule( $moduleName );
			if ( $module instanceof RL\WikiModule && $module->getGroup() !== RL\Module::GROUP_USER ) {
				$summary = $module->getDefinitionSummary( $rlContext );
				foreach ( $summary[0]['pages'] as $page => $details ) {
					if ( $details['type'] === 'script' ) {
						$title = Title::newFromText( $page );
						if ( $title ) {
							$pages[$title->getNamespace()][] = $title->getDBkey();
						}
					}
				}
			}
		}
		return $pages;
	}
}
