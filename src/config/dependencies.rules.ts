import { policy } from '@finografic/deps-policy';

import type { DependencyRule } from 'types/dependencies.types';

const dev = policy.base.devDependencies ?? {};

/**
 * Dependency version rules for template migrations.
 * Versions are sourced from @finografic/deps-policy — edit versions there, not here.
 *
 * Entries without a version (eslint-plugin-markdownlint, @finografic/project-scripts)
 * are ecosystem-optional and install @latest.
 */
export const dependencyRules: DependencyRule[] = [
  // core tooling
  { name: 'typescript', version: dev['typescript'], section: 'devDependencies' },
  { name: 'tsdown', version: dev['tsdown'], section: 'devDependencies' },
  { name: '@types/node', version: dev['@types/node'], section: 'devDependencies' },
  { name: 'vitest', version: dev['vitest'], section: 'devDependencies' },
  { name: 'simple-git-hooks', version: dev['simple-git-hooks'], section: 'devDependencies' },
  { name: 'lint-staged', version: dev['lint-staged'], section: 'devDependencies' },

  // eslint stack
  { name: 'eslint', version: dev['eslint'], section: 'devDependencies' },
  {
    name: '@finografic/eslint-config',
    version: dev['@finografic/eslint-config'],
    section: 'devDependencies',
  },
  { name: '@eslint/js', version: dev['@eslint/js'], section: 'devDependencies' },
  { name: 'eslint-plugin-markdownlint', section: 'devDependencies' },
  { name: '@stylistic/eslint-plugin', version: dev['@stylistic/eslint-plugin'], section: 'devDependencies' },
  {
    name: '@typescript-eslint/parser',
    version: dev['@typescript-eslint/parser'],
    section: 'devDependencies',
  },
  {
    name: '@typescript-eslint/eslint-plugin',
    version: dev['@typescript-eslint/eslint-plugin'],
    section: 'devDependencies',
  },
  { name: 'typescript-eslint', version: dev['typescript-eslint'], section: 'devDependencies' },
  { name: 'globals', version: dev['globals'], section: 'devDependencies' },

  // formatting
  { name: 'oxfmt', version: dev['oxfmt'], section: 'devDependencies' },
  { name: '@finografic/oxfmt-config', version: dev['@finografic/oxfmt-config'], section: 'devDependencies' },

  // commitlint
  { name: '@commitlint/cli', version: dev['@commitlint/cli'], section: 'devDependencies' },
  {
    name: '@commitlint/config-conventional',
    version: dev['@commitlint/config-conventional'],
    section: 'devDependencies',
  },

  // finografic ecosystem
  { name: '@finografic/project-scripts', section: 'devDependencies' },
];
