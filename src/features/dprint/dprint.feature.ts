import type { Feature } from '../feature.types';
import { applyDprint } from './dprint.apply';
import { DPRINT_VSCODE_EXTENSION } from './dprint.constants';
import { detectDprint } from './dprint.detect';

/**
 * dprint feature definition.
 */
export const dprintFeature: Feature = {
  id: 'dprint',
  label: 'dprint formatting (extends @finografic/dprint-config)',
  hint: 'recommended',
  vscode: {
    extensions: [DPRINT_VSCODE_EXTENSION],
  },
  detect: detectDprint,
  apply: applyDprint,
};
