import { policy } from 'config/policy.js';
import type { DependencyRule } from 'types/dependencies.types';

const dev = policy.base.devDependencies ?? {};

/**
 * Dependency version rules for template upgrades. Versions are sourced from @finografic/deps-policy — edit
 * versions there, not here.
 *
 * Entries without a version install @latest. Entries with optional: true are only aligned if already present
 * — never force-added.
 */
export const dependencyRules: DependencyRule[] = [
  // build
  { name: 'typescript', version: dev['typescript'], section: 'devDependencies', group: 'build' },
  // Optional: a package that builds with Vite (or does not build at all) has no use for tsdown, and
  // force-adding a second bundler to a frontend app is not an alignment.
  { name: 'tsdown', version: dev['tsdown'], section: 'devDependencies', optional: true, group: 'build' },
  { name: '@types/node', version: dev['@types/node'], section: 'devDependencies', group: 'build' },

  // testing
  // Optional: the `vitest` feature installs it. Force-adding it here put vitest into packages that
  // had deliberately not selected the feature.
  { name: 'vitest', version: dev['vitest'], section: 'devDependencies', optional: true, group: 'testing' },

  // linting
  { name: 'oxlint', version: dev['oxlint'], section: 'devDependencies', optional: true, group: 'linting' },
  {
    name: 'oxlint-tsgolint',
    version: dev['oxlint-tsgolint'],
    section: 'devDependencies',
    optional: true,
    group: 'linting',
  },
  {
    name: '@finografic/md-lint',
    version: dev['@finografic/md-lint'],
    section: 'devDependencies',
    optional: true,
    group: 'linting',
  },
  {
    name: '@finografic/oxc-config',
    version: dev['@finografic/oxc-config'],
    section: 'devDependencies',
    optional: true,
    group: 'linting',
  },

  // formatting
  { name: 'oxfmt', version: dev['oxfmt'], section: 'devDependencies', optional: true, group: 'formatting' },

  // hooks
  { name: 'husky', version: dev['husky'], section: 'devDependencies', group: 'hooks' },
  { name: 'lint-staged', version: dev['lint-staged'], section: 'devDependencies', group: 'hooks' },
  { name: '@commitlint/cli', version: dev['@commitlint/cli'], section: 'devDependencies', group: 'hooks' },
  {
    name: '@commitlint/config-conventional',
    version: dev['@commitlint/config-conventional'],
    section: 'devDependencies',
    group: 'hooks',
  },

  // ecosystem
  // Optional: a toolbox a project opts into, not a requirement of being a @finografic package.
  {
    name: '@finografic/project-scripts',
    version: dev['@finografic/project-scripts'],
    section: 'devDependencies',
    optional: true,
    group: 'ecosystem',
  },
];
