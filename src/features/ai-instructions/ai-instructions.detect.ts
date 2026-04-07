import type { FeatureContext } from '../feature.types';

import { hasPreviewChanges } from '../../lib/feature-preview/feature-preview.utils.js';
import { previewAiInstructions } from './ai-instructions.preview.js';

/**
 * Detect when AI instructions are fully aligned with the canonical preview.
 */
export async function detectAiInstructions(context: FeatureContext): Promise<boolean> {
  const preview = await previewAiInstructions(context);
  return !hasPreviewChanges(preview);
}
