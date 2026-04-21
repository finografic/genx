import type { FeatureContext } from '../feature.types';

import { hasPreviewChanges } from '../../lib/feature-preview/feature-preview.utils.js';
import { previewCss } from './css.preview.js';

/**
 * Detect when CSS tooling matches the canonical preview (no legacy Stylelint, VS Code + oxfmt for CSS/SCSS).
 */
export async function detectCss(context: FeatureContext): Promise<boolean> {
  const preview = await previewCss(context);
  return !hasPreviewChanges(preview);
}
