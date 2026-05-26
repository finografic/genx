import type { CommandHelpConfig } from '@finografic/cli-kit/render-help';

export const help: CommandHelpConfig = {
  command: 'genx managed',
  description: 'Run a command across all managed targets',
  usage: 'genx managed <command> [options]',
  subcommands: [
    { name: 'migrate', description: 'Run migrate across managed targets' },
    { name: 'deps', description: 'Sync deps across managed targets' },
    { name: 'features', description: 'Add features across managed targets' },
  ],
  options: [
    { flag: '-y, --yes', description: 'Skip per-target and per-file confirms' },
    { flag: '--allow-downgrade', description: 'Include downgrades (deps only)' },
  ],
  examples: [
    { command: 'genx managed migrate', description: 'Migrate all managed targets' },
    { command: 'genx managed deps', description: 'Sync deps for all managed targets' },
    { command: 'genx managed deps --yes', description: 'Sync deps non-interactively' },
    { command: 'genx managed features', description: 'Add features to all managed targets' },
  ],
  howItWorks: [
    'Reads managed targets from ~/.config/finografic/genx.config.jsonc',
    'Iterates each target, prompting to apply or skip (unless --yes)',
    'Runs the selected command (migrate, deps, features) on each target',
  ],
};
