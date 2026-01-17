/**
 * dprint feature configuration.
 *
 * DPRINT_PACKAGE_VERSION is used when the feature adds the dep (installs @latest).
 * Template (templates/package/package.json) and dependency rules use ^0.8.0;
 * bump those when releasing a new @finografic/dprint-config.
 */

export const DPRINT_PACKAGE = '@finografic/dprint-config';
export const DPRINT_PACKAGE_VERSION = 'latest';

export const FORMATTING_SECTION_TITLE = '·········· FORMATTING';
export const FORMATTING_SCRIPTS = {
  format: 'dprint fmt --diff',
  'format.check': 'dprint check',
};
