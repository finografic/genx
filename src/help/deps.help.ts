import type { HelpConfig } from 'core/render-help';

import { defaultHelpOptions } from 'config/help.config';

export const depsHelp: HelpConfig = {
  main: {
    bin: 'genx deps',
    args: '[path] [options]',
  },

  examples: {
    title: 'Examples',
    list: [
      {
        label: 'Dry run in current directory',
        description: 'genx deps',
      },
      {
        label: 'Dry run against a specific directory',
        description: 'genx deps ../my-package',
      },
      {
        label: 'Apply changes to current directory',
        description: 'genx deps --write',
      },
      {
        label: 'Apply changes to a specific directory',
        description: 'genx deps ../my-package --write',
      },
      {
        label: 'Sync all managed targets',
        description: 'genx deps --managed --write',
      },
      {
        label: 'Include policy downgrades (dry run)',
        description: 'genx deps --allow-downgrade',
      },
    ],
  },

  footer: {
    title: 'Show Help',
    list: [
      {
        label: 'genx deps --help',
        description: 'Show this help message',
      },
    ],
  },

  minWidth: defaultHelpOptions.minWidth,
};
