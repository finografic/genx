import type { PackageConfig } from '@finografic/core';

import type { FeatureId } from 'features/feature.types';

import { promptAuthor } from 'lib/prompts/author.prompt';
import { promptFeatures } from 'lib/prompts/features.prompt';
import { promptPackageManifest } from 'lib/prompts/package-manifest.prompt';
import { promptPackageType } from 'lib/prompts/package-type.prompt';
import { defaultValuesConfig } from 'config/values.config';
import type { PackageType } from 'types/package-type.types';
import { cancel } from './prompts.utils';

interface PackageConfigWithFeatures extends PackageConfig {
  features: FeatureId[];
  packageType: PackageType;
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
  const packageType = await promptPackageType();
  if (!packageType) return cancel();

  const manifest = await promptPackageManifest(defaultValuesConfig);
  if (!manifest) return cancel();

  const scope = manifest.scope;
  const author = await promptAuthor(defaultValuesConfig.author, scope);
  if (!author) return cancel();

  const features = await promptFeatures(packageType.defaultFeatures);
  if (!features) return cancel();

  return {
    ...manifest,
    author,
    features,
    packageType,
  };
}
