import type { CommandHelpConfig } from '@finografic/cli-kit/render-help';

export const help: CommandHelpConfig = {
  command: 'genx features',
  description: 'Add optional features to an existing @finografic package',
  usage: 'genx features [path] [options]',
  examples: [
    { command: 'genx features', description: 'Add features to current directory' },
    { command: 'genx features --managed', description: 'Add the same features across managed targets' },
  ],
};
