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
   * Offline fallback tag — **not** the default source.
   *
   * Generation resolves the newest tag on the remote, because tagging the starter is already the
   * sign-off; a pin here would duplicate that decision and then go stale unnoticed. This value is
   * used only when the remote cannot be reached, and that case is announced rather than silent.
   *
   * Keep it roughly current so an offline run still produces something recent, but it no longer has
   * to be bumped in lockstep with the starter.
   */
  pinnedTag: string;

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
   * Filename prefixes removed from the generated repo's `docs/todo/` — the starter's own build
   * history, which is meaningless in a new project.
   */
  docsTodoResetPrefixes: readonly string[];
}

export const monorepoConfig: MonorepoConfig = {
  repoUrl: 'git@github.com:finografic/monorepo-starter.git',

  pinnedTag: 'v0.2.2',

  rootFeatures: ['aiAgents', 'aiInstructions', 'aiMemory', 'designMd'],

  docsTodoResetPrefixes: ['TODO_', 'DONE_'],
};
