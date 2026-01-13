import type { PackageConfig } from '@finografic/core';

import type { FeatureId } from 'features/feature.types';
import { promptAuthor } from 'prompts/author.prompt';
import { promptFeatures } from 'prompts/features.prompt';
import { promptPackageManifest } from 'prompts/package-manifest.prompt';

import { defaultValuesConfig } from 'config/values.config';
import { cancel } from './prompts.utils';

interface PackageConfigWithFeatures extends PackageConfig {
  features: FeatureId[];
}

/**
 * Prompt for package configuration.
 *
 * This file is pure orchestration:
 * - no validation logic
 * - no clack primitives
 * - uniform cancellation
 */
export async function promptCreatePackage(): Promise<PackageConfigWithFeatures | null> {
  const manifest = await promptPackageManifest(defaultValuesConfig);
  if (!manifest) return cancel();

  const author = await promptAuthor(defaultValuesConfig.author);
  if (!author) return cancel();

  const features = await promptFeatures();
  if (!features) return cancel();

  return {
    ...manifest,
    author,
    features,
  };
}
