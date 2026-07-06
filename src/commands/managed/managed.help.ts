import type { CommandHelpConfig } from '@finografic/cli-kit/render-help';

export const help: CommandHelpConfig = {
  command: 'genx managed',
  description: 'Run a command across all managed targets',
  usage: 'genx managed <command> [options]',
  subcommands: [
    { name: 'upgrade', description: 'Upgrade managed targets to current conventions' },
    { name: 'deps', description: 'Sync deps across managed targets' },
    { name: 'audit', description: 'Audit and repair feature state across managed targets' },
  ],
  options: [
    { flag: '-y, --yes', description: 'Skip per-target and per-file confirms' },
    { flag: '--allow-downgrade', description: 'Include downgrades (deps only)' },
  ],
  examples: [
    { command: 'genx managed upgrade', description: 'Upgrade all managed targets' },
    { command: 'genx managed deps', description: 'Sync deps for all managed targets' },
    { command: 'genx managed deps --yes', description: 'Sync deps non-interactively' },
    { command: 'genx managed audit', description: 'Audit and repair feature state' },
  ],
  howItWorks: [
    'Reads managed targets from ~/.config/finografic/genx.config.jsonc',
    'Runs the selected command (upgrade, deps, or audit) on each target',
    'Managed audit scans all targets first, then repairs selected targets',
  ],
};
