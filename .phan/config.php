<?php

$cfg = require __DIR__ . '/../vendor/mediawiki/mediawiki-phan-config/src/config.php';

// This value should match the PHP version specified in composer.json and PHPVersionCheck.php.
$cfg['minimum_target_php_version'] = '8.1.0';

$cfg['directory_list'] = array_merge(
	$cfg['directory_list'],
	[
		'../../extensions/Gadgets',
		'../../extensions/BetaFeatures',
		'../../extensions/Scribunto',
		'../../extensions/TemplateStyles',
	]
);

$cfg['exclude_analysis_directory_list'] = array_merge(
	$cfg['exclude_analysis_directory_list'],
	[
		'../../extensions/Gadgets',
		'../../extensions/BetaFeatures',
		'../../extensions/Scribunto',
		'../../extensions/TemplateStyles',
	]
);

return $cfg;
