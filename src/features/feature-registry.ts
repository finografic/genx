import { dprintFeature } from './dprint';
import type { Feature, FeatureId } from './feature.types';

/**
 * Registry of all available features.
 * Add new features here as they are implemented.
 */
export const features: Feature[] = [
  dprintFeature,
  // TODO: Add other features as they are migrated:
  // vitestFeature,
  // githubWorkflowFeature,
  // aiRulesFeature,
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
