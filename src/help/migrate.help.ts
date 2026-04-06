import type { HelpConfig } from 'core/render-help';

import { defaultHelpOptions } from 'config/help.config';

export const migrateHelp: HelpConfig = {
  main: {
    bin: 'genx migrate',
    args: '[path] [options]',
  },
  examples: {
    title: 'Examples',
    list: [
      { label: 'Dry run in current directory', description: 'genx migrate' },
      {
        label: 'Dry run against a specific directory',
        description: 'genx migrate ../my-package',
      },
      {
        label: 'Apply changes to a directory',
        description: 'genx migrate ../my-package --write',
      },
      {
        label: 'Only update specific sections',
        description: 'genx migrate --only=package-json,eslint --write',
      },
      {
        label: 'Update dependencies and Node version',
        description: 'genx migrate --only=dependencies,node --write',
      },
      {
        label: 'Normalize file names and merge configs',
        description: 'genx migrate --only=renames,merges --write',
      },
      {
        label: 'Migrate all managed targets',
        description: 'genx migrate --managed --write',
      },
    ],
  },
  footer: {
    title: 'Show Help',
    list: [{ label: 'genx migrate --help', description: 'Show this help message' }],
  },
  minWidth: defaultHelpOptions.minWidth,
};
