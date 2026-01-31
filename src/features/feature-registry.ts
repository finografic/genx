import { aiRulesFeature } from './ai-rules/ai-rules.feature';
import { dprintFeature } from './dprint/dprint.feature';
import { gitHooksFeature } from './git-hooks/git-hooks.feature';
import { markdownFeature } from './markdown/markdown.feature';
import { vitestFeature } from './vitest/vitest.feature';
import type { Feature, FeatureId } from './feature.types';

/**
 * Registry of all available features.
 * Add new features here as they are implemented.
 */
export const features: Feature[] = [
  dprintFeature,
  vitestFeature,
  aiRulesFeature,
  markdownFeature,
  gitHooksFeature,
  // TODO: Add other features as they are migrated:
  // githubWorkflowFeature,
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
