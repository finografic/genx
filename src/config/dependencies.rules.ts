import { policy } from '@finografic/deps-policy';

import type { DependencyRule } from 'types/dependencies.types';

const dev = policy.base.devDependencies ?? {};

/**
 * Dependency version rules for template migrations. Versions are sourced from @finografic/deps-policy — edit
 * versions there, not here.
 *
 * Entries without a version install @latest. Entries with optional: true are only aligned if already present
 * — never force-added.
 */
export const dependencyRules: DependencyRule[] = [
  // core tooling
  { name: 'typescript', version: dev['typescript'], section: 'devDependencies' },
  { name: 'tsdown', version: dev['tsdown'], section: 'devDependencies' },
  { name: '@types/node', version: dev['@types/node'], section: 'devDependencies' },
  { name: 'vitest', version: dev['vitest'], section: 'devDependencies' },
  { name: 'husky', version: dev['husky'], section: 'devDependencies' },
  { name: 'lint-staged', version: dev['lint-staged'], section: 'devDependencies' },

  // markdown linting (optional — only aligned if already present)
  {
    name: '@finografic/md-lint',
    version: dev['@finografic/md-lint'],
    section: 'devDependencies',
    optional: true,
  },

  // oxc toolchain (oxfmt formatter + oxlint linter)
  { name: 'oxfmt', version: dev['oxfmt'], section: 'devDependencies', optional: true },
  {
    name: '@finografic/oxc-config',
    version: dev['@finografic/oxc-config'],
    section: 'devDependencies',
    optional: true,
  },
  { name: 'oxlint', version: dev['oxlint'], section: 'devDependencies', optional: true },
  {
    name: 'oxlint-tsgolint',
    version: dev['oxlint-tsgolint'],
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
