import type { HelpConfig } from '@finografic/cli-kit/render-help';

import { defaultHelpOptions } from 'config/help.config';

export const auditHelp: HelpConfig = {
  main: {
    bin: 'genx audit',
    args: '[path] [options]',
  },

  examples: {
    title: 'Examples',
    list: [
      {
        label: 'Audit current directory',
        description: 'genx audit',
      },
      {
        label: 'Audit a specific directory',
        description: 'genx audit ../my-package',
      },
      {
        label: 'Apply all partial/missing features without prompts',
        description: 'genx audit -y',
      },
    ],
  },

  footer: {
    title: 'Show Help',
    list: [
      {
        label: 'genx audit --help',
        description: 'Show this help message',
      },
    ],
  },

  minWidth: defaultHelpOptions.minWidth,
};
