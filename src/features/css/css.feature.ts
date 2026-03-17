import type { Feature } from '../feature.types';
import { applyCss } from './css.apply';
import { CSS_VSCODE_EXTENSIONS } from './css.constants';
import { detectCss } from './css.detect';

/**
 * CSS linting feature definition.
 */
export const cssFeature: Feature = {
  id: 'css',
  label: 'CSS linting (stylelint + @stylistic)',
  hint: 'recommended for frontend packages',
  vscode: {
    extensions: CSS_VSCODE_EXTENSIONS,
  },
  detect: detectCss,
  apply: applyCss,
};
