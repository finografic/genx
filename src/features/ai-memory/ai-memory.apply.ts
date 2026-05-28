import type { FeatureApplyResult, FeatureContext } from '../feature.types';

import { finalizeLegacyAiFolderAfterApply } from '../../lib/agents-legacy-ai-folder.utils.js';
import { applyPreviewChanges } from '../../lib/feature-preview/index.js';
import { untrackGitignoredPathsIfNeeded } from '../../lib/gitignore-index-sync.utils.js';
import { AI_MEMORY_UNTRACK_IF_INDEXED } from './ai-memory.constants.js';
import { previewAiMemory } from './ai-memory.preview.js';

/**
 * Apply project memory model using `previewAiMemory` + `applyPreviewChanges`.
 * Untracks gitignored memory paths that remain in the index when needed.
 */
export async function applyAiMemory(context: FeatureContext): Promise<FeatureApplyResult> {
  const preview = await previewAiMemory(context);
  const result = await applyPreviewChanges(preview, { yesAll: context.yesAll });
  await finalizeLegacyAiFolderAfterApply(context.targetDir);

  const untracked = await untrackGitignoredPathsIfNeeded(context.targetDir, AI_MEMORY_UNTRACK_IF_INDEXED);
  for (const rel of untracked) {
    result.applied.push(`untracked ${rel} (git index)`);
  }

  return result;
}
