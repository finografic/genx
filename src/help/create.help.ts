import { defaultHelpOptions } from 'config/help.config';
import type { HelpConfig } from 'types/help.types';

export const createHelp: HelpConfig = {
  main: {
    bin: 'finografic-create create',
  },

  examples: {
    title: 'Examples',
    list: [
      {
        label: 'Create a new package interactively',
        description: 'finografic-create create',
      },
    ],
  },

  footer: {
    title: 'Show Help',
    list: [
      {
        label: 'finografic-create create --help',
        description: 'Show this help message',
      },
    ],
  },

  minWidth: defaultHelpOptions.minWidth,
};
