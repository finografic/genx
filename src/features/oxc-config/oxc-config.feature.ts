import type { Feature } from '../feature.types';

import { applyOxcConfig } from './oxc-config.apply';
import { OXFMT_VSCODE_EXTENSIONS } from './oxc-config.constants';
import { detectOxcConfig } from './oxc-config.detect';

/**
 * Oxc-config feature — Prettier → oxfmt/oxlint migration for packages not created from the latest template.
 */
export const oxcConfigFeature: Feature = {
  id: 'oxc-config',
  label: 'oxc-config (oxfmt formatter + oxlint linter)',
  hint: 'optional',
  vscode: {
    extensions: OXFMT_VSCODE_EXTENSIONS,
  },
  detect: detectOxcConfig,
  apply: applyOxcConfig,
};
