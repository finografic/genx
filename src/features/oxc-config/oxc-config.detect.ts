import type { FeatureContext } from '../feature.types';

import { hasPreviewChanges } from '../../lib/feature-preview/feature-preview.utils.js';
import { previewOxfmt } from './oxc-config.preview.js';

/**
 * Detect if oxfmt is already fully configured in the target directory. Uses `previewOxfmt` (package.json,
 * config, workflows, VS Code, ESLint, Prettier/dprint cleanup surfaces) — returns true only when preview
 * reports no relevant file changes.
 */
export async function detectOxfmt(context: FeatureContext): Promise<boolean> {
  const preview = await previewOxfmt(context);
  return !hasPreviewChanges(preview);
}
