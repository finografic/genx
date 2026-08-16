import type { FeatureId } from 'features/feature.types';

/**
 * Configuration for `genx create monorepo`.
 *
 * The monorepo template is NOT `_templates/` — it is the `monorepo-starter` repository, which
 * stays a real, running, testable app. See `docs/todo/TODO_MONOREPO_GENERATOR.md`.
 */
export interface MonorepoConfig {
  /** SSH clone URL for the canonical monorepo starter. */
  repoUrl: string;

  /**
   * Tag the generator clones.
   *
   * Bumped manually, as a deliberate genx release decision — never track a branch, because
   * generation must be reproducible for a given genx version.
   */
  pinnedTag: string;

  /**
   * Features applied to the workspace root after scaffolding.
   *
   * Package-scoped features (`vitest`, `css`, `reactVite`) assume a single-package `src/` layout
   * and are excluded until `upgrade` learns to iterate workspace members.
   */
  rootFeatures: readonly FeatureId[];

  /**
   * Filename prefixes removed from the generated repo's `docs/todo/` — the starter's own build
   * history, which is meaningless in a new project.
   */
  docsTodoResetPrefixes: readonly string[];
}

export const monorepoConfig: MonorepoConfig = {
  repoUrl: 'git@github.com:finografic/monorepo-starter.git',

  pinnedTag: 'v0.2.1',

  rootFeatures: ['oxc-config', 'markdown', 'gitHooks', 'aiAgents', 'aiInstructions', 'aiMemory', 'designMd'],

  docsTodoResetPrefixes: ['TODO_', 'DONE_'],
};
