import type { CommandHelpConfig } from '@finografic/cli-kit/render-help';

export const help: CommandHelpConfig = {
  command: 'genx migrate',
  description: 'Migrate an existing @finografic package to the latest conventions',
  usage: 'genx migrate [path] [options]',
  examples: [
    { command: 'genx migrate', description: 'Select migrate operations for the current directory' },
    {
      command: 'genx migrate ../my-package',
      description: 'Select migrate operations for a specific directory',
    },
    {
      command: 'genx migrate --yes',
      description: 'Skip per-file and per-target confirms once selections are chosen',
    },
  ],
};
