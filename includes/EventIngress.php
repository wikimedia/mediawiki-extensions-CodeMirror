<?php

namespace MediaWiki\Extension\CodeMirror;

use MediaWiki\DomainEvent\DomainEventIngress;
use MediaWiki\Page\Event\PageLatestRevisionChangedEvent;
use MediaWiki\Page\Event\PageLatestRevisionChangedListener;
use MediaWiki\Storage\PageUpdateCauses;
use MediaWiki\Title\Title;
use WANObjectCache;

class EventIngress extends DomainEventIngress implements PageLatestRevisionChangedListener {

	public function __construct( private readonly WANObjectCache $cache ) {
	}

	/**
	 * Regenerate list of JS pages requiring validation, whenever new JS pages are created or deleted.
	 * @param PageLatestRevisionChangedEvent $event
	 */
	public function handlePageLatestRevisionChangedEvent( PageLatestRevisionChangedEvent $event ): void {
		if ( $event->isNominalContentChange() || $event->hasCause( PageUpdateCauses::CAUSE_MOVE ) ) {
			$title = Title::newFromPageIdentity( $event->getPage() );
			if ( $title->hasContentModel( CONTENT_MODEL_JAVASCRIPT ) ) {
				$this->cache->touchCheckKey( JavaScriptValidator::PAGES_CACHE_KEY );
			}
		}
	}
}
