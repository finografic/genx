import type { HelpConfig } from '@finografic/cli-kit/render-help';

import { defaultHelpOptions } from 'config/help.config';

export const cliHelp: HelpConfig = {
  main: {
    bin: 'genx',
    args: '<command> [options]',
  },

  commands: {
    title: 'Commands',
    list: [
      { label: 'create', description: 'Scaffold a new @finografic package' },
      { label: 'upgrade', description: 'Upgrade an existing package to current conventions' },
      { label: 'deps', description: 'Sync dependencies to @finografic/deps-policy' },
      { label: 'managed', description: 'Run a command across all managed targets' },
      { label: 'audit', description: 'Scan features and apply what is missing or partial' },
      { label: 'help', description: 'Show this help message' },
    ],
    options: {
      labels: {
        minWidth: 8,
      },
    },
  },

  examples: {
    title: 'Examples',
    list: [
      { label: 'Create a new package', description: 'genx create' },
      { label: 'Upgrade current directory', description: 'genx upgrade' },
      {
        label: 'Upgrade a specific directory',
        description: 'genx upgrade ../my-package',
      },
      {
        label: 'Sync deps (interactive package selection)',
        description: 'genx deps',
      },
      {
        label: 'Audit features and apply missing ones',
        description: 'genx audit',
      },
      {
        label: 'Run upgrade across managed targets',
        description: 'genx managed upgrade',
      },
      {
        label: 'Run deps across managed targets',
        description: 'genx managed deps',
      },
    ],
  },

  footer: {
    title: 'Show Help',
    list: [
      { label: 'genx help', description: '' },
      { label: 'genx <command> --help', description: '' },
    ],
  },

  minWidth: defaultHelpOptions.minWidth,
};
