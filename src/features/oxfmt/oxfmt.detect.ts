import type { FeatureContext } from '../feature.types';

import { hasPreviewChanges } from '../../lib/feature-preview/feature-preview.utils.js';
import { previewOxfmt } from './oxfmt.preview.js';

/**
 * Detect if oxfmt is already fully configured in the target directory.
 * Uses previewed canonical outputs (package.json + `oxfmt.config.ts`) — returns true only when
 * preview reports no relevant file changes.
 */
export async function detectOxfmt(context: FeatureContext): Promise<boolean> {
  const preview = await previewOxfmt(context);
  return !hasPreviewChanges(preview);
}
