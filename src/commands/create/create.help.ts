import type { CommandHelpConfig } from '@finografic/cli-kit/render-help';

export const help: CommandHelpConfig = {
  command: 'genx create',
  description: 'Create a new @finografic package from template',
  usage: 'genx create [options]',
  options: [
    { flag: '--type <type>', description: 'Package type (cli, library, config)' },
    { flag: '--name <name>', description: 'Package name (@finografic/...)' },
    { flag: '-y, --yes', description: 'Accept defaults without prompting' },
  ],
  examples: [
    { command: 'genx create', description: 'Create a new package interactively' },
    { command: 'genx create --type cli', description: 'Create a CLI package' },
    {
      command: 'genx create --type library --name my-lib',
      description: 'Create a library with a specific name',
    },
  ],
  howItWorks: [
    'Prompts for package type, name, author, and optional features',
    'Copies _templates/ into the target directory with variable substitution',
    'Applies selected features (oxc-config, git-hooks, etc.)',
    'Runs pnpm install and initializes a git repository',
  ],
};
