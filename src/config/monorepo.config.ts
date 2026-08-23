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
   * Features applied to the workspace root after scaffolding.
   *
   * Deliberately limited to features that write documentation and agent content only. Three
   * categories are excluded:
   *
   * - **Toolchain-shaped** (`oxc-config`, `markdown`, `gitHooks`) — their canonical content is written for a
   *   single package. `oxc-config` in particular rewrites `update:oxc-config` without `--recursive` (which
   *   silently stops updating workspace members) and swaps the root `oxlint.config.ts` for the _library_
   *   preset. The starter already owns these correctly.
   * - **Package-scoped** (`vitest`, `css`, `reactVite`) — they assume a single-package `src/` layout and need
   *   to run per workspace member.
   * - Anything that mutates the root `package.json`.
   *
   * The features listed here only read `package.json` (for template variables) and write
   * markdown, `.agents/`, `.cursor/rules`, `.github/copilot-instructions.md`, and `.gitignore`.
   */
  rootFeatures: readonly FeatureId[];

  /**
   * Features that `upgrade` runs against each selected workspace member instead of the root.
   *
   * These assume a single-package `src/` layout — a vitest config, a CSS entry point, a Vite app —
   * so running them at the root writes files nothing reads. Any feature that is in neither this
   * list nor {@link rootFeatures} is starter-owned toolchain and is skipped at the root entirely.
   */
  memberFeatures: readonly FeatureId[];

  /**
   * Filename prefixes removed from the generated repo's `docs/todo/` — the starter's own build
   * history, which is meaningless in a new project.
   */
  docsTodoResetPrefixes: readonly string[];
}

export const monorepoConfig: MonorepoConfig = {
  repoUrl: 'git@github.com:finografic/monorepo-starter.git',

  rootFeatures: ['aiAgents', 'aiInstructions', 'aiMemory', 'designMd'],

  memberFeatures: ['vitest', 'css', 'reactVite'],

  docsTodoResetPrefixes: ['TODO_', 'DONE_'],
};
