import type { Feature } from '../feature.types';

import { applyOxcConfig } from './oxc-config.apply';
import { OXC_CONFIG_PACKAGE, OXFMT_VSCODE_EXTENSIONS } from './oxc-config.constants';
import { auditOxcConfig, detectOxcConfig } from './oxc-config.detect';

/**
 * Oxc-config feature — Prettier → oxfmt/oxlint migration for packages not created from the latest template.
 */
export const oxcConfigFeature: Feature = {
  id: 'oxc-config',
  selfPackageName: OXC_CONFIG_PACKAGE,
  label: 'oxc-config (oxfmt formatter + oxlint linter)',
  hint: 'optional',
  vscode: {
    extensions: OXFMT_VSCODE_EXTENSIONS,
  },
  detect: detectOxcConfig,
  audit: auditOxcConfig,
  apply: applyOxcConfig,
};
