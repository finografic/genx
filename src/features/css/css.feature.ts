import type { Feature } from '../feature.types';

import { applyCss } from './css.apply';
import { auditCss, detectCss } from './css.detect';

/**
 * CSS formatting feature — ensures oxfmt handles CSS/SCSS.
 */
export const cssFeature: Feature = {
  id: 'css',
  label: 'CSS formatting (oxfmt)',
  hint: 'recommended for frontend packages',
  detect: detectCss,
  audit: auditCss,
  apply: applyCss,
};
