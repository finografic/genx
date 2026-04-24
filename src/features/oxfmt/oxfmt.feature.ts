import type { Feature } from '../feature.types';

import { applyOxfmt } from './oxfmt.apply';
import { OXFMT_VSCODE_EXTENSIONS } from './oxfmt.constants';
import { detectOxfmt } from './oxfmt.detect';

/**
 * Oxfmt feature — Prettier → oxfmt migration for packages not created from the latest template.
 */
export const oxfmtFeature: Feature = {
  id: 'oxfmt',
  label: 'oxc-config (oxfmt formatter + oxlint linter)',
  hint: 'optional',
  vscode: {
    extensions: OXFMT_VSCODE_EXTENSIONS,
  },
  detect: detectOxfmt,
  apply: applyOxfmt,
};
