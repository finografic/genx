import type { Feature } from '../feature.types';

import { applyOxfmt } from './oxfmt.apply';
import { OXFMT_VSCODE_EXTENSIONS } from './oxfmt.constants';
import { detectOxfmt } from './oxfmt.detect';

/**
 * oxfmt feature — Prettier → oxfmt migration for packages not created from the latest template.
 */
export const oxfmtFeature: Feature = {
  id: 'oxfmt',
  label: 'oxfmt formatting (extends @finografic/oxfmt-config)',
  hint: 'optional',
  vscode: {
    extensions: OXFMT_VSCODE_EXTENSIONS,
  },
  detect: detectOxfmt,
  apply: applyOxfmt,
};
