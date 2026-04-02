import type { Feature } from '../feature.types';

import { applyMarkdown } from './markdown.apply';
import { MARKDOWNLINT_VSCODE_EXTENSIONS } from './markdown.constants';
import { detectMarkdown } from './markdown.detect';

/**
 * Markdown linting feature definition.
 */
export const markdownFeature: Feature = {
  id: 'markdown',
  label: 'Markdown linting (eslint-plugin-markdownlint)',
  hint: 'recommended',
  vscode: {
    extensions: MARKDOWNLINT_VSCODE_EXTENSIONS,
  },
  detect: detectMarkdown,
  apply: applyMarkdown,
};
