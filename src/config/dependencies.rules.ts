import type { DependencyRule } from 'types/dependencies.types';

/**
 * Dependency version rules for template migrations.
 *
 * Version is optional - omit to install @latest.
 * Specify a fixed version only when necessary (e.g., breaking changes).
 *
 * When migrating, versions are compared and newer versions are installed.
 */

export const dependencyRules: DependencyRule[] = [
  // core tooling
  { name: 'typescript', section: 'devDependencies' },
  { name: 'tsdown', section: 'devDependencies' },
  { name: 'vitest', section: 'devDependencies' },
  { name: 'simple-git-hooks', section: 'devDependencies' },
  { name: 'lint-staged', section: 'devDependencies' },

  // eslint stack
  { name: 'eslint', section: 'devDependencies' },
  { name: '@eslint/js', section: 'devDependencies' },
  { name: 'eslint-plugin-markdownlint', section: 'devDependencies' },
  { name: '@stylistic/eslint-plugin', section: 'devDependencies' },
  { name: '@typescript-eslint/parser', section: 'devDependencies' },
  { name: '@typescript-eslint/eslint-plugin', section: 'devDependencies' },
  { name: 'typescript-eslint', section: 'devDependencies' },
  { name: 'eslint-plugin-simple-import-sort', section: 'devDependencies' },

  // formatting
  { name: '@finografic/dprint-config', section: 'devDependencies' },

  // commitlint
  { name: '@commitlint/cli', section: 'devDependencies' },
  { name: '@commitlint/config-conventional', section: 'devDependencies' },

  // finografic ecosystem
  { name: '@finografic/project-scripts', section: 'devDependencies' },
];
