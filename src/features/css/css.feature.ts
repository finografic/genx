import type { Feature } from '../feature.types';

import { applyCss } from './css.apply';
import { auditCss, detectCss } from './css.detect';

/**
 * CSS formatting feature — ensures oxfmt handles CSS/SCSS and removes legacy stylelint.
 */
export const cssFeature: Feature = {
  id: 'css',
  label: 'CSS formatting (oxfmt) — removes legacy stylelint if present',
  hint: 'recommended for frontend packages',
  detect: detectCss,
  audit: auditCss,
  apply: applyCss,
};
