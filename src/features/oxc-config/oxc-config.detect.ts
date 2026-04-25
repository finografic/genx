import type { FeatureContext } from '../feature.types';

import { hasPreviewChanges } from '../../lib/feature-preview/feature-preview.utils.js';
import { previewOxcConfig } from './oxc-config.preview.js';

/**
 * Detect if oxc-config is already fully configured in the target directory. Uses `previewOxcConfig`
 * (package.json, config, workflows, VS Code, ESLint, Prettier/dprint cleanup surfaces) — returns true only
 * when preview reports no relevant file changes.
 */
export async function detectOxcConfig(context: FeatureContext): Promise<boolean> {
  const preview = await previewOxcConfig(context);
  return !hasPreviewChanges(preview);
}
