import { describe, expect, it } from 'vitest';
import type { PackageJson } from '../types/package-json.types.js';

import {
  detectLegacyPackageJsonFeatureIds,
  getAssociatedLegacyFeatureIds,
  getAssociatedLegacyRootFiles,
  getLegacyRootFiles,
  removeAssociatedLegacyPackageJsonDependencies,
  removeLegacyPackageJsonDependencies,
} from './legacy-removal.utils.js';

describe('legacy-removal.utils', () => {
  it('returns associated legacy stacks for oxc-config', () => {
    expect(getAssociatedLegacyFeatureIds('oxc-config')).toEqual(['eslint', 'dprint']);
  });

  it('detects only the requested legacy stacks present in package.json', () => {
    const packageJson: PackageJson = {
      devDependencies: {
        '@eslint/js': '^9.39.2',
        '@finografic/dprint-config': '^0.12.4',
        'oxfmt': '^0.52.0',
      },
    };

    expect(detectLegacyPackageJsonFeatureIds(packageJson, ['eslint', 'dprint'])).toEqual([
      'eslint',
      'dprint',
    ]);
    expect(detectLegacyPackageJsonFeatureIds(packageJson, ['dprint'])).toEqual(['dprint']);
  });

  it('removes requested legacy dependencies from dependencies and devDependencies', () => {
    const packageJson: PackageJson = {
      dependencies: {
        eslint: '^9.39.2',
        react: '^19.0.0',
      },
      devDependencies: {
        '@eslint/js': '^9.39.2',
        '@finografic/dprint-config': '^0.12.4',
        'dprint': '^0.51.1',
        'oxfmt': '^0.52.0',
      },
    };

    expect(removeLegacyPackageJsonDependencies(packageJson, ['eslint', 'dprint'])).toEqual({
      dependencies: {
        react: '^19.0.0',
      },
      devDependencies: {
        oxfmt: '^0.52.0',
      },
    });
  });

  it('removes the legacy dependencies associated with a feature id', () => {
    const packageJson: PackageJson = {
      devDependencies: {
        '@eslint/js': '^9.39.2',
        '@finografic/dprint-config': '^0.12.4',
        '@finografic/oxc-config': '^2.6.2',
        'oxfmt': '^0.52.0',
      },
    };

    expect(removeAssociatedLegacyPackageJsonDependencies(packageJson, 'oxc-config')).toEqual({
      devDependencies: {
        '@finografic/oxc-config': '^2.6.2',
        'oxfmt': '^0.52.0',
      },
    });
  });

  it('exposes root files for future file removals', () => {
    expect(getLegacyRootFiles(['eslint', 'dprint'])).toEqual([
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
      'dprint.json',
      'dprint.jsonc',
      'dprint.config.jsonc',
    ]);
  });

  it('exposes associated root files for a feature id', () => {
    expect(getAssociatedLegacyRootFiles('oxc-config')).toEqual([
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
      'dprint.json',
      'dprint.jsonc',
      'dprint.config.jsonc',
    ]);
  });
});
