import type { CommandHelpConfig } from '@finografic/cli-kit/render-help';

export const help: CommandHelpConfig = {
  command: 'genx deps',
  description: 'Sync package dependencies to @finografic/deps-policy',
  usage: 'genx deps [path] [--update-policy] [options]',
  examples: [
    { command: 'genx deps', description: 'Interactive sync in current directory (select packages to apply)' },
    { command: 'genx deps ../my-package', description: 'Interactive sync for a specific directory' },
    {
      command: 'genx deps --yes',
      description: 'Apply all planned changes without multiselect (CI / non-interactive)',
    },
    {
      command: 'genx deps --managed',
      description: 'Sync all managed targets (prompt per target unless --yes)',
    },
    {
      command: 'genx deps --allow-downgrade',
      description: 'Include policy downgrades when planning changes',
    },
    { command: 'genx deps --update-policy', description: 'Update deps-policy interactively (no dep sync)' },
  ],
};
