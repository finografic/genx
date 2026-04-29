import type { CommandHelpConfig } from '@finografic/cli-kit/render-help';

export const help: CommandHelpConfig = {
  command: 'genx create',
  description: 'Create a new @finografic package from template',
  usage: 'genx create',
  examples: [{ command: 'genx create', description: 'Create a new package interactively' }],
};
