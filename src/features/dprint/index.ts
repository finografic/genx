import type { Feature } from '../feature.types';
import { applyDprint } from './dprint.apply';
import { detectDprint } from './dprint.detect';

/**
 * dprint feature definition.
 */
export const dprintFeature: Feature = {
  id: 'dprint',
  label: 'dprint formatting (extends @finografic/dprint-config)',
  hint: 'recommended',
  detect: detectDprint,
  apply: applyDprint,
};
