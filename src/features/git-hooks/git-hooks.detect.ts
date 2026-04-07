import type { FeatureContext } from '../feature.types';

import { hasPreviewChanges } from '../../lib/feature-preview/feature-preview.utils.js';
import { previewGitHooks } from './git-hooks.preview.js';

/**
 * True when the git-hooks feature has nothing left to apply — uses `previewGitHooks`.
 *
 * Lint-staged and commitlint are checked independently via the same preview as apply.
 */
export async function isGitHooksFullyConfigured(targetDir: string): Promise<boolean> {
  const preview = await previewGitHooks({ targetDir });
  return !hasPreviewChanges(preview);
}

/**
 * Used by `genx features` / migrate: when `true`, the feature is skipped (nothing to do).
 */
export async function detectGitHooks(context: FeatureContext): Promise<boolean> {
  return isGitHooksFullyConfigured(context.targetDir);
}
