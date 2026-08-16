import type { CommandHelpConfig } from '@finografic/cli-kit/render-help';

import { monorepoConfig } from 'config/monorepo.config';

/**
 * `owner/repo` slug derived from the clone URL.
 *
 * Help text uses the slug rather than the full SSH URL: a bare `git@host:…` string trips
 * markdownlint MD034 (no-bare-urls) once the README generator renders it. The full URL stays in
 * `monorepo.config.ts`, which is where anyone needing it will look.
 */
const repoSlug = monorepoConfig.repoUrl.replace(/^git@github\.com:/, '').replace(/\.git$/, '');

export const help: CommandHelpConfig = {
  command: 'genx create monorepo',
  description: 'Create a new full-stack monorepo from the pinned monorepo-starter tag',
  usage: 'genx create monorepo [options]',
  options: [
    { flag: '--name <name>', description: 'Workspace name (without scope)' },
    { flag: '--tag <tag>', description: 'Starter tag to use; "latest" resolves the newest remote tag' },
    { flag: '--no-install', description: 'Skip pnpm install, env seeding, and database setup' },
    { flag: '-y, --yes', description: 'Accept defaults without prompting' },
  ],
  examples: [
    { command: 'genx create monorepo', description: 'Create a new monorepo interactively' },
    {
      command: 'genx create monorepo --name my-app',
      description: 'Create a monorepo with a specific name',
    },
    {
      command: 'genx create monorepo --tag latest',
      description: 'Use the newest tag on the starter remote',
    },
    {
      command: 'genx create monorepo --tag v0.2.0',
      description: 'Generate from a specific older tag',
    },
    {
      command: 'genx create monorepo --no-install',
      description: 'Scaffold without running pnpm install',
    },
  ],
  howItWorks: [
    'Prompts for workspace name, description, and author',
    `Clones ${repoSlug} at tag ${monorepoConfig.pinnedTag} and drops its git history`,
    'Rewrites root identity (package.json, README, project memory) — app code is untouched',
    'Applies policy toolchain versions and runs pnpm install',
    'Applies documentation/agent features only — toolchain config comes from the starter',
    'Seeds .env.development with a fresh AUTH_SECRET, then runs pnpm dev:db:reset',
    'Initializes a fresh git repository and prints the managed-config block to register it',
  ],
  sections: [
    {
      title: 'TEMPLATE SOURCE',
      // Key/value lines only — the README generator turns two-space-separated pairs into a table
      // and falls back to raw (badly rendered) text if any line is prose. Rationale lives in
      // docs/process/MONOREPO_GENERATION.md.
      content: [
        `  repo      ${repoSlug}`,
        `  tag       ${monorepoConfig.pinnedTag} (this release's pin)`,
        '  source    the starter repo, not _templates/ — it stays a real app that builds and runs',
        '  scope     internal packages keep the generic @workspace/* scope',
        '  override  --tag, then monorepoStarter.tag / .path in genx.config.jsonc',
        '  local     set monorepoStarter.path to generate from a working tree, no tag needed',
      ].join('\n'),
    },
  ],
};
