import type { FlowContext } from '@finografic/cli-kit/flow';
import type { PackageConfig } from '@finografic/core';
import type { FeatureId } from 'features/feature.types';

import type { Author } from 'lib/prompts/author.prompt';
import { promptAuthor } from 'lib/prompts/author.prompt';
import { promptFeatures } from 'lib/prompts/features.prompt';
import type { PackageManifest } from 'lib/prompts/package-manifest.prompt';
import { promptPackageManifest } from 'lib/prompts/package-manifest.prompt';
import { promptPackageType } from 'lib/prompts/package-type.prompt';

import { defaultValuesConfig } from 'config/values.config';
import type { PackageType } from 'types/package-type.types';

interface PackageConfigWithFeatures extends PackageConfig {
  features: FeatureId[];
  packageType: PackageType;
}

export interface MonorepoCreateConfig extends PackageManifest {
  author: Author;
}

const FIXED_CREATE_FEATURES = ['markdown', 'oxc-config'] as const satisfies readonly FeatureId[];

/**
 * Prompt for package configuration.
 *
 * This file is pure orchestration:
 * - no validation logic
 * - no clack primitives
 * - uniform cancellation
 */
export async function promptCreatePackage(flow: FlowContext): Promise<PackageConfigWithFeatures> {
  const packageType = await promptPackageType(flow);
  const manifest = await promptPackageManifest(flow, defaultValuesConfig);
  const { scope } = manifest;
  const author = await promptAuthor(flow, defaultValuesConfig.author, scope);
  const selectedFeatures = await promptFeatures(flow, {
    excludedValues: FIXED_CREATE_FEATURES,
    initialValues: packageType.defaultFeatures,
  });
  const features = [...new Set<FeatureId>([...FIXED_CREATE_FEATURES, ...selectedFeatures])];

  return {
    ...manifest,
    author,
    features,
    packageType,
  };
}

/**
 * Prompt for monorepo configuration.
 *
 * No package-type prompt and no feature picker: the shape comes from the pinned `monorepo-starter`
 * tag, and root features are a fixed allowlist in `config/monorepo.config.ts`.
 */
export async function promptCreateMonorepo(flow: FlowContext): Promise<MonorepoCreateConfig> {
  const manifest = await promptPackageManifest(flow, defaultValuesConfig);
  const author = await promptAuthor(flow, defaultValuesConfig.author, manifest.scope);

  return { ...manifest, author };
}
