import type { Feature } from '../feature.types';

import { applyVitest } from './vitest.apply';
import { detectVitest } from './vitest.detect';

/**
 * Vitest feature definition.
 */
export const vitestFeature: Feature = {
  id: 'vitest',
  label: 'Vitest testing setup',
  hint: 'recommended',
  detect: detectVitest,
  apply: applyVitest,
};
