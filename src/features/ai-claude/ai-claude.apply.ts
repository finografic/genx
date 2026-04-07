import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileExists } from 'utils';
import type { FeatureApplyResult, FeatureContext } from '../feature.types';

import { applyPreviewChanges } from '../../lib/feature-preview/index.js';
import { previewAiClaude } from './ai-claude.preview.js';

/**
 * Apply Claude Code support using `previewAiClaude` + `applyPreviewChanges`.
 * Ensures `.claude/assets/` exists (directory-only step not represented in preview writes).
 */
export async function applyAiClaude(context: FeatureContext): Promise<FeatureApplyResult> {
  const preview = await previewAiClaude(context);
  const result = await applyPreviewChanges(preview);

  const assetsDest = resolve(context.targetDir, '.claude/assets');
  if (!fileExists(assetsDest)) {
    await mkdir(assetsDest, { recursive: true });
    return { ...result, applied: [...result.applied, '.claude/assets/'] };
  }

  return result;
}
