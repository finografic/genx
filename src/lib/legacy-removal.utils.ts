import type { FeatureId } from '../features/feature.types.js';
import type { PackageJson } from '../types/package-json.types.js';

export type LegacyFeatureId = 'dprint' | 'eslint';

interface LegacyRemovalDefinition {
  packageJsonDependencies: readonly string[];
  rootFiles: readonly string[];
}

const EMPTY_LEGACY_FEATURE_IDS: readonly LegacyFeatureId[] = [];

const LEGACY_REMOVAL_REGISTRY: Record<LegacyFeatureId, LegacyRemovalDefinition> = {
  eslint: {
    packageJsonDependencies: [
      'eslint',
      '@eslint/js',
      '@finografic/eslint-config',
      '@stylistic/eslint-plugin',
      '@typescript-eslint/parser',
      '@typescript-eslint/eslint-plugin',
      'typescript-eslint',
      'eslint-plugin-markdownlint',
      'eslint-plugin-simple-import-sort',
      'globals',
    ],
    rootFiles: [
      'eslint.config.js',
      'eslint.config.cjs',
      'eslint.config.mjs',
      'eslint.config.ts',
      '.eslintrc',
      '.eslintrc.js',
      '.eslintrc.cjs',
      '.eslintrc.json',
      '.eslintrc.yaml',
      '.eslintrc.yml',
      '.eslintignore',
    ],
  },
  dprint: {
    packageJsonDependencies: ['dprint', '@finografic/dprint-config'],
    rootFiles: ['dprint.json', 'dprint.jsonc', 'dprint.config.jsonc'],
  },
};

const FEATURE_LEGACY_ASSOCIATIONS: Partial<Record<FeatureId, readonly LegacyFeatureId[]>> = {
  'oxc-config': ['eslint', 'dprint'],
};

function collectDependencyNames(packageJson: PackageJson): Set<string> {
  const names = new Set<string>();

  if (packageJson.dependencies && typeof packageJson.dependencies === 'object') {
    for (const name of Object.keys(packageJson.dependencies)) {
      names.add(name);
    }
  }

  if (packageJson.devDependencies && typeof packageJson.devDependencies === 'object') {
    for (const name of Object.keys(packageJson.devDependencies)) {
      names.add(name);
    }
  }

  return names;
}

function collectLegacyPackageNames(legacyFeatureIds: readonly LegacyFeatureId[]): string[] {
  const names = new Set<string>();

  for (const legacyFeatureId of legacyFeatureIds) {
    const definition = LEGACY_REMOVAL_REGISTRY[legacyFeatureId];
    for (const packageName of definition.packageJsonDependencies) {
      names.add(packageName);
    }
  }

  return [...names];
}

function stripListedDependencies(packageJson: PackageJson, packageNames: readonly string[]): PackageJson {
  if (packageNames.length === 0) {
    return packageJson;
  }

  const next = JSON.parse(JSON.stringify(packageJson)) as PackageJson;
  const dependencies = { ...next.dependencies };
  const devDependencies = { ...next.devDependencies };

  for (const packageName of packageNames) {
    delete dependencies[packageName];
    delete devDependencies[packageName];
  }

  if (Object.keys(dependencies).length === 0) {
    delete next.dependencies;
  } else {
    next.dependencies = dependencies;
  }

  if (Object.keys(devDependencies).length === 0) {
    delete next.devDependencies;
  } else {
    next.devDependencies = devDependencies;
  }

  return next;
}

export function getAssociatedLegacyFeatureIds(featureId: FeatureId): readonly LegacyFeatureId[] {
  return FEATURE_LEGACY_ASSOCIATIONS[featureId] ?? EMPTY_LEGACY_FEATURE_IDS;
}

export function detectLegacyPackageJsonFeatureIds(
  packageJson: PackageJson,
  legacyFeatureIds: readonly LegacyFeatureId[],
): LegacyFeatureId[] {
  if (legacyFeatureIds.length === 0) {
    return [];
  }

  const dependencyNames = collectDependencyNames(packageJson);
  const detected: LegacyFeatureId[] = [];

  for (const legacyFeatureId of legacyFeatureIds) {
    const definition = LEGACY_REMOVAL_REGISTRY[legacyFeatureId];
    if (definition.packageJsonDependencies.some((packageName) => dependencyNames.has(packageName))) {
      detected.push(legacyFeatureId);
    }
  }

  return detected;
}

export function removeLegacyPackageJsonDependencies(
  packageJson: PackageJson,
  legacyFeatureIds: readonly LegacyFeatureId[],
): PackageJson {
  return stripListedDependencies(packageJson, collectLegacyPackageNames(legacyFeatureIds));
}

export function removeAssociatedLegacyPackageJsonDependencies(
  packageJson: PackageJson,
  featureId: FeatureId,
): PackageJson {
  return removeLegacyPackageJsonDependencies(packageJson, getAssociatedLegacyFeatureIds(featureId));
}

export function getLegacyRootFiles(legacyFeatureIds: readonly LegacyFeatureId[]): string[] {
  const files = new Set<string>();

  for (const legacyFeatureId of legacyFeatureIds) {
    const definition = LEGACY_REMOVAL_REGISTRY[legacyFeatureId];
    for (const rootFile of definition.rootFiles) {
      files.add(rootFile);
    }
  }

  return [...files];
}

export function getAssociatedLegacyRootFiles(featureId: FeatureId): string[] {
  return getLegacyRootFiles(getAssociatedLegacyFeatureIds(featureId));
}
