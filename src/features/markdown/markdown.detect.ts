import type { FeatureContext } from '../feature.types';

import { hasPreviewChanges } from '../../lib/feature-preview/feature-preview.utils.js';
import { previewMarkdown } from './markdown.preview.js';

/**
 * Detect if markdown linting is already fully configured for owned files (deps, ESLint block, VS Code,
 * lint-staged, CSS assets).
 */
export async function detectMarkdown(context: FeatureContext): Promise<boolean> {
  const preview = await previewMarkdown(context);
  return !hasPreviewChanges(preview);
}
