import type { CommandHelpConfig } from '@finografic/cli-kit/render-help';

export const help: CommandHelpConfig = {
  command: 'genx audit',
  description: 'Audit a package for missing or partial @finografic features',
  usage: 'genx audit [path] [options]',
  examples: [
    { command: 'genx audit', description: 'Audit current directory' },
    { command: 'genx audit ../my-package', description: 'Audit a specific directory' },
    {
      command: 'genx audit -y',
      description: 'Apply selected features without per-file confirmation prompts',
    },
  ],
};
