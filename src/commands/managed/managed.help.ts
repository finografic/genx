import type { CommandHelpConfig } from '@finografic/cli-kit/render-help';

export const help: CommandHelpConfig = {
  command: 'genx managed',
  description: 'Run a command across all managed targets',
  usage: 'genx managed <command> [options]',
  subcommands: [
    { name: 'upgrade', description: 'Upgrade managed targets to current conventions' },
    { name: 'deps', description: 'Sync deps across managed targets' },
  ],
  options: [
    { flag: '-y, --yes', description: 'Skip per-target and per-file confirms' },
    { flag: '--allow-downgrade', description: 'Include downgrades (deps only)' },
  ],
  examples: [
    { command: 'genx managed upgrade', description: 'Upgrade all managed targets' },
    { command: 'genx managed deps', description: 'Sync deps for all managed targets' },
    { command: 'genx managed deps --yes', description: 'Sync deps non-interactively' },
  ],
  howItWorks: [
    'Reads managed targets from ~/.config/finografic/genx.config.jsonc',
    'Iterates each target, prompting to apply or skip (unless --yes)',
    'Runs the selected command (upgrade or deps) on each target',
  ],
};
