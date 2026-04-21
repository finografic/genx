import type { FlowContext } from '@finografic/cli-kit/flow';
import type { PackageConfig } from '@finografic/core';
import type { FeatureId } from 'features/feature.types';

import { promptAuthor } from 'lib/prompts/author.prompt';
import { promptFeatures } from 'lib/prompts/features.prompt';
import { promptPackageManifest } from 'lib/prompts/package-manifest.prompt';
import { promptPackageType } from 'lib/prompts/package-type.prompt';

import { defaultValuesConfig } from 'config/values.config';
import type { PackageType } from 'types/package-type.types';

interface PackageConfigWithFeatures extends PackageConfig {
  features: FeatureId[];
  packageType: PackageType;
}

/**
 * Prompt for package configuration.
 *
 * This file is pure orchestration: - no validation logic - no clack primitives - uniform cancellation
 */
export async function promptCreatePackage(flow: FlowContext): Promise<PackageConfigWithFeatures> {
  const packageType = await promptPackageType(flow);
  const manifest = await promptPackageManifest(flow, defaultValuesConfig);
  const { scope } = manifest;
  const author = await promptAuthor(flow, defaultValuesConfig.author, scope);
  const features = await promptFeatures(flow, packageType.defaultFeatures, ['oxcConfig']);

  return {
    ...manifest,
    author,
    features,
    packageType,
  };
}
