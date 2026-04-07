import type { FeatureContext } from '../feature.types';

import { hasPreviewChanges } from '../../lib/feature-preview/feature-preview.utils.js';
import { previewAiAgents } from './ai-agents.preview.js';

/**
 * Detect when ai-agents has nothing left to apply — aligned with `previewAiAgents`.
 */
export async function detectAiAgents(context: FeatureContext): Promise<boolean> {
  const preview = await previewAiAgents(context);
  return !hasPreviewChanges(preview);
}
