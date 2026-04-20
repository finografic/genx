import type { HelpConfig } from '@finografic/cli-kit/render-help';

import { defaultHelpOptions } from 'config/help.config';

export const featuresHelp: HelpConfig = {
  main: {
    bin: 'genx features',
    args: '[path] [options]',
  },

  examples: {
    title: 'Examples',
    list: [
      {
        label: 'Add features to current directory',
        description: 'genx features',
      },
      {
        label: 'Add the same features across managed targets',
        description: 'genx features --managed',
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
