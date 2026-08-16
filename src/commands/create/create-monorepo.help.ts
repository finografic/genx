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
    { flag: '--no-install', description: 'Skip pnpm install' },
    { flag: '-y, --yes', description: 'Accept defaults without prompting' },
  ],
  examples: [
    { command: 'genx create monorepo', description: 'Create a new monorepo interactively' },
    {
      command: 'genx create monorepo --name my-app',
      description: 'Create a monorepo with a specific name',
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
    'Applies policy toolchain versions, runs pnpm install, and applies root-scoped features',
    'Initializes a fresh git repository and prints the managed-config block to register it',
  ],
  sections: [
    {
      title: 'TEMPLATE SOURCE',
      // Key/value lines only — the README generator turns two-space-separated pairs into a table
      // and falls back to raw (badly rendered) text if any line is prose. Rationale lives in
      // docs/process/MONOREPO_GENERATION.md.
      content: [
        `  repo    ${repoSlug}`,
        `  tag     ${monorepoConfig.pinnedTag}`,
        '  source  the starter repo, not _templates/ — it stays a real app that builds and runs',
        '  tags    bumped manually in src/config/monorepo.config.ts',
        '  scope   internal packages keep the generic @workspace/* scope',
      ].join('\n'),
    },
  ],
};
