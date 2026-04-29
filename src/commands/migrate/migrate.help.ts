import type { CommandHelpConfig } from '@finografic/cli-kit/render-help';

export const help: CommandHelpConfig = {
  command: 'genx migrate',
  description: 'Migrate an existing @finografic package to the latest conventions',
  usage: 'genx migrate [path] [options]',
  examples: [
    { command: 'genx migrate', description: 'Dry run in current directory' },
    { command: 'genx migrate ../my-package', description: 'Dry run against a specific directory' },
    { command: 'genx migrate ../my-package --write', description: 'Apply changes to a directory' },
    {
      command: 'genx migrate --only=package-json,oxc-config --write',
      description: 'Only update specific sections',
    },
    {
      command: 'genx migrate --only=dependencies,node --write',
      description: 'Update dependencies and Node version',
    },
    {
      command: 'genx migrate --only=renames,merges --write',
      description: 'Normalize file names and merge configs',
    },
    { command: 'genx migrate --managed --write', description: 'Migrate all managed targets' },
  ],
};
