import { policy } from '@finografic/deps-policy';

import type { DependencyRule } from 'types/dependencies.types';

const dev = policy.base.devDependencies ?? {};

/**
 * Dependency version rules for template migrations.
 * Versions are sourced from @finografic/deps-policy — edit versions there, not here.
 *
 * Entries without a version install @latest.
 * Entries with optional: true are only aligned if already present — never force-added.
 */
export const dependencyRules: DependencyRule[] = [
  // core tooling
  { name: 'typescript', version: dev['typescript'], section: 'devDependencies' },
  { name: 'tsdown', version: dev['tsdown'], section: 'devDependencies' },
  { name: '@types/node', version: dev['@types/node'], section: 'devDependencies' },
  { name: 'vitest', version: dev['vitest'], section: 'devDependencies' },
  { name: 'husky', version: dev['husky'], section: 'devDependencies' },
  { name: 'lint-staged', version: dev['lint-staged'], section: 'devDependencies' },

  // eslint stack
  { name: 'eslint', version: dev['eslint'], section: 'devDependencies' },
  {
    name: '@finografic/eslint-config',
    version: dev['@finografic/eslint-config'],
    section: 'devDependencies',
  },
  { name: '@eslint/js', version: dev['@eslint/js'], section: 'devDependencies' },
  {
    name: 'eslint-plugin-markdownlint',
    version: dev['eslint-plugin-markdownlint'],
    section: 'devDependencies',
    optional: true,
  },
  {
    name: '@stylistic/eslint-plugin',
    version: dev['@stylistic/eslint-plugin'],
    section: 'devDependencies',
    optional: true,
  },
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

  // formatting (optional — only aligned if already present; not forced on dprint or other formatter projects)
  { name: 'oxfmt', version: dev['oxfmt'], section: 'devDependencies', optional: true },
  {
    name: '@finografic/oxfmt-config',
    version: dev['@finografic/oxfmt-config'],
    section: 'devDependencies',
    optional: true,
  },

  // commitlint
  { name: '@commitlint/cli', version: dev['@commitlint/cli'], section: 'devDependencies' },
  {
    name: '@commitlint/config-conventional',
    version: dev['@commitlint/config-conventional'],
    section: 'devDependencies',
  },

  // finografic ecosystem
  {
    name: '@finografic/project-scripts',
    version: dev['@finografic/project-scripts'],
    section: 'devDependencies',
  },
];
