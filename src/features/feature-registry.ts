import type { Feature, FeatureId } from './feature.types';

import { aiClaudeFeature } from './ai-claude/ai-claude.feature';
import { aiInstructionsFeature } from './ai-instructions/ai-instructions.feature';
import { cssFeature } from './css/css.feature';
import { gitHooksFeature } from './git-hooks/git-hooks.feature';
import { markdownFeature } from './markdown/markdown.feature';
import { oxfmtFeature } from './oxfmt/oxfmt.feature';
import { vitestFeature } from './vitest/vitest.feature';

/**
 * Registry of all available features.
 * Add new features here as they are implemented.
 */
export const features: Feature[] = [
  oxfmtFeature,
  vitestFeature,
  cssFeature,
  aiInstructionsFeature,
  aiClaudeFeature,
  markdownFeature,
  gitHooksFeature,
];

/**
 * Get a feature by its ID.
 */
export function getFeature(id: FeatureId): Feature | undefined {
  return features.find((f) => f.id === id);
}

/**
 * Get all feature IDs.
 */
export function getFeatureIds(): FeatureId[] {
  return features.map((f) => f.id);
}
