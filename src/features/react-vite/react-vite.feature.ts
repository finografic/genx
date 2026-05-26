import type { Feature } from '../feature.types';

import { applyReactVite } from './react-vite.apply';
import { auditReactVite, detectReactVite } from './react-vite.detect';

/**
 * React + Vite feature definition.
 * Ensures Vite, React, Panda CSS, PostCSS, and design-system wiring are present.
 */
export const reactViteFeature: Feature = {
  id: 'reactVite',
  label: 'React + Vite frontend',
  hint: undefined,
  detect: detectReactVite,
  audit: auditReactVite,
  apply: applyReactVite,
};
