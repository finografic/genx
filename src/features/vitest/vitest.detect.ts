import type { FeatureContext } from '../feature.types';

import { hasPreviewChanges } from '../../lib/feature-preview/feature-preview.utils.js';
import { previewVitest } from './vitest.preview.js';

/**
 * Detect if vitest feature is fully present (config, scripts, dependency) — aligned with `previewVitest`.
 */
export async function detectVitest(context: FeatureContext): Promise<boolean> {
  const preview = await previewVitest(context);
  return !hasPreviewChanges(preview);
}
