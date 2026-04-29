import type { FeatureApplyResult, FeatureContext } from '../feature.types';

import { finalizeLegacyAiFolderAfterApply } from '../../lib/agents-legacy-ai-folder.utils.js';
import { applyPreviewChanges } from '../../lib/feature-preview/index.js';
import { previewAiInstructions } from './ai-instructions.preview.js';

/**
 * Apply AI Instructions using `previewAiInstructions` + `applyPreviewChanges`.
 */
export async function applyAiInstructions(context: FeatureContext): Promise<FeatureApplyResult> {
  const preview = await previewAiInstructions(context);
  const result = await applyPreviewChanges(preview, { yesAll: context.yesAll });
  await finalizeLegacyAiFolderAfterApply(context.targetDir);
  return result;
}
