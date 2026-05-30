import type { PackageJson } from 'types/package-json.types';

export const KNOWN_PACKAGE_TYPE_IDS = ['library', 'cli', 'config', 'react'] as const;

export type KnownPackageTypeId = (typeof KNOWN_PACKAGE_TYPE_IDS)[number];

function getKeywords(packageJson: PackageJson): string[] {
  return Array.isArray(packageJson.keywords)
    ? packageJson.keywords.filter((keyword): keyword is string => typeof keyword === 'string')
    : [];
}

function getDependencyNames(packageJson: PackageJson): Set<string> {
  return new Set([
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.devDependencies ?? {}),
  ]);
}

function getExplicitPackageTypeId(packageJson: PackageJson): KnownPackageTypeId | null {
  for (const keyword of getKeywords(packageJson)) {
    if (!keyword.startsWith('genx:type:')) {
      continue;
    }
    const packageTypeId = keyword.slice('genx:type:'.length);
    if ((KNOWN_PACKAGE_TYPE_IDS as readonly string[]).includes(packageTypeId)) {
      return packageTypeId as KnownPackageTypeId;
    }
  }
  return null;
}

function inferPackageTypeFromHeuristics(packageJson: PackageJson): KnownPackageTypeId {
  const keywords = getKeywords(packageJson);
  const deps = getDependencyNames(packageJson);
  const name = typeof packageJson.name === 'string' ? packageJson.name : '';
  const hasBin =
    typeof packageJson.bin === 'string' ||
    (typeof packageJson.bin === 'object' &&
      packageJson.bin !== null &&
      !Array.isArray(packageJson.bin) &&
      Object.keys(packageJson.bin).length > 0);

  if (hasBin || keywords.includes('cli')) {
    return 'cli';
  }

  if (
    (deps.has('react') && deps.has('vite')) ||
    (deps.has('react') && deps.has('@vitejs/plugin-react')) ||
    (keywords.includes('react') && keywords.includes('vite'))
  ) {
    return 'react';
  }

  if (
    keywords.includes('shared-config') ||
    (keywords.includes('config') && !keywords.includes('react')) ||
    /(?:^|\/)(?:eslint|ts|vitest|vite|prettier|oxc|typescript)-config(?:$|[-/])/.test(name)
  ) {
    return 'config';
  }

  return 'library';
}

export function inferPackageTypeId(packageJson: PackageJson): KnownPackageTypeId {
  return getExplicitPackageTypeId(packageJson) ?? inferPackageTypeFromHeuristics(packageJson);
}

export function isPackageType(packageJson: PackageJson, packageTypeId: KnownPackageTypeId): boolean {
  return inferPackageTypeId(packageJson) === packageTypeId;
}

export function isFrontendPackageType(packageTypeId: KnownPackageTypeId): boolean {
  return packageTypeId === 'react';
}
