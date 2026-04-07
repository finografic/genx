import type { FeatureContext } from '../feature.types';

import { hasPreviewChanges } from '../../lib/feature-preview/feature-preview.utils.js';
import { previewAiClaude } from './ai-claude.preview.js';

/**
 * Detect when Claude Code support matches the canonical preview.
 */
export async function detectAiClaude(context: FeatureContext): Promise<boolean> {
  const preview = await previewAiClaude(context);
  return !hasPreviewChanges(preview);
}
