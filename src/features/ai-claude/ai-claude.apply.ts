import type { FeatureApplyResult, FeatureContext } from '../feature.types';

import { applyPreviewChanges } from '../../lib/feature-preview/index.js';
import { previewAiClaude } from './ai-claude.preview.js';

/**
 * Apply Claude Code support using `previewAiClaude` + `applyPreviewChanges`.
 * `.claude/assets/` is represented in preview as `.claude/assets/.gitkeep` when the directory is missing.
 */
export async function applyAiClaude(context: FeatureContext): Promise<FeatureApplyResult> {
  const preview = await previewAiClaude(context);
  return applyPreviewChanges(preview);
}
