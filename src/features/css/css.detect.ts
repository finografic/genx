import type { FeatureContext } from '../feature.types';

import { hasPreviewChanges } from '../../lib/feature-preview/feature-preview.utils.js';
import { previewCss } from './css.preview.js';

/**
 * Detect when CSS linting matches the canonical preview (deps, stylelint, VS Code, oxfmt).
 */
export async function detectCss(context: FeatureContext): Promise<boolean> {
  const preview = await previewCss(context);
  return !hasPreviewChanges(preview);
}
