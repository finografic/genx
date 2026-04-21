import type { Feature } from '../feature.types';

import { applyOxfmt } from './oxc-config.apply';
import { OXFMT_VSCODE_EXTENSIONS } from './oxc-config.constants';
import { detectOxfmt } from './oxc-config.detect';

/**
 * Oxc-config — align `@finografic/oxc-config` + oxfmt + oxlint with the finografic template (migrate path).
 */
export const oxcConfigFeature: Feature = {
  id: 'oxcConfig',
  label: 'Oxc toolchain (@finografic/oxc-config, oxfmt, oxlint)',
  hint: 'optional',
  vscode: {
    extensions: OXFMT_VSCODE_EXTENSIONS,
  },
  detect: detectOxfmt,
  apply: applyOxfmt,
};
