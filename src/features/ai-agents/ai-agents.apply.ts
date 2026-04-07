import type { FeatureApplyResult, FeatureContext } from '../feature.types';

import { applyPreviewChanges } from '../../lib/feature-preview/index.js';
import { previewAiAgents } from './ai-agents.preview.js';

/**
 * Apply ai-agents using `previewAiAgents` + `applyPreviewChanges`.
 */
export async function applyAiAgents(context: FeatureContext): Promise<FeatureApplyResult> {
  const preview = await previewAiAgents(context);
  return applyPreviewChanges(preview);
}
