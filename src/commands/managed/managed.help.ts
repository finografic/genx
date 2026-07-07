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
    {
      flag: '-y, --yes',
      description: 'Skip per-target and per-file confirms; audit still prompts for features',
    },
    {
      flag: '--features=<keys>',
      description: 'Comma-separated feature keys to apply (managed audit only)',
    },
    { flag: '--allow-downgrade', description: 'Include downgrades (deps only)' },
    { flag: '--update-policy', description: 'Refresh deps-policy before syncing (deps only)' },
  ],
  examples: [
    { command: 'genx managed upgrade', description: 'Upgrade all managed targets' },
    { command: 'genx managed deps', description: 'Sync deps for all managed targets' },
    {
      command: 'genx managed deps --update-policy',
      description: 'Refresh deps-policy, then sync all managed targets',
    },
    { command: 'genx managed deps --yes', description: 'Sync deps non-interactively' },
    { command: 'genx managed audit', description: 'Audit each target and choose features per project' },
    {
      command: 'genx managed audit --features=ai-memory',
      description: 'Apply AI Memory repairs where needed',
    },
    {
      command: 'genx managed audit --features=ai-memory,vitest',
      description: 'Apply selected feature repairs where needed',
    },
    { command: 'genx managed audit -y', description: 'Audit each target; skip apply/file confirms' },
  ],
  howItWorks: [
    'Reads managed targets from ~/.config/finografic/genx.config.jsonc',
    'Runs the selected command (upgrade, deps, or audit) on each target',
    'Managed deps uses the current policy snapshot unless --update-policy is passed',
    'Managed audit scans all targets first, then prompts for feature selection per target',
    'Managed audit --features skips feature selection and applies only matching partial/missing features',
  ],
};
