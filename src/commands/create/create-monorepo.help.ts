import type { CommandHelpConfig } from '@finografic/cli-kit/render-help';

import { monorepoConfig } from 'config/monorepo.config';

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
    `Clones ${monorepoConfig.repoUrl} at tag ${monorepoConfig.pinnedTag} and drops its git history`,
    'Rewrites root identity (package.json, README, project memory) — app code is untouched',
    'Applies policy toolchain versions, runs pnpm install, and applies root-scoped features',
    'Initializes a fresh git repository and prints the managed-config block to register it',
  ],
  sections: [
    {
      title: 'TEMPLATE SOURCE',
      content: [
        `  repo   ${monorepoConfig.repoUrl}`,
        `  tag    ${monorepoConfig.pinnedTag}`,
        '',
        '  The monorepo template is the monorepo-starter repository, not _templates/ — it stays',
        '  a real app that builds and runs. The tag is bumped manually in monorepo.config.ts.',
        '',
        '  Internal workspace packages keep the generic @workspace/* scope.',
      ].join('\n'),
    },
  ],
};
