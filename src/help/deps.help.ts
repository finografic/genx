import type { HelpConfig } from '@finografic/cli-kit/render-help';

import { defaultHelpOptions } from 'config/help.config';

export const depsHelp: HelpConfig = {
  main: {
    bin: 'genx deps',
    args: '[path] [--update-policy] [options]',
  },

  examples: {
    title: 'Examples',
    list: [
      {
        label: 'Interactive sync in current directory (select packages to apply)',
        description: 'genx deps',
      },
      {
        label: 'Interactive sync for a specific directory',
        description: 'genx deps ../my-package',
      },
      {
        label: 'Apply all planned changes without multiselect (CI / non-interactive)',
        description: 'genx deps --yes',
      },
      {
        label: 'Sync all managed targets (prompt per target unless --yes)',
        description: 'genx deps --managed',
      },
      {
        label: 'Include policy downgrades when planning changes',
        description: 'genx deps --allow-downgrade',
      },
      {
        label: 'Update deps-policy interactively (no dep sync)',
        description: 'genx deps --update-policy',
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
