import type { HelpConfig } from 'core/render-help';

import { defaultHelpOptions } from 'config/help.config';

export const featuresHelp: HelpConfig = {
  main: {
    bin: 'genx features',
  },

  examples: {
    title: 'Examples',
    list: [
      {
        label: 'Add features to current directory',
        description: 'genx features',
      },
    ],
  },

  footer: {
    title: 'Show Help',
    list: [
      {
        label: 'genx features --help',
        description: 'Show this help message',
      },
    ],
  },

  minWidth: defaultHelpOptions.minWidth,
};
