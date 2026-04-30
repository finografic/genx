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
      { label: 'migrate', description: 'Sync conventions to an existing package' },
      { label: 'deps', description: 'Sync dependencies to @finografic/deps-policy' },
      { label: 'features', description: 'Add optional features to an existing package' },
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
      { label: 'Migrate current directory', description: 'genx migrate' },
      {
        label: 'Migrate a specific directory',
        description: 'genx migrate ../my-package',
      },
      {
        label: 'Run migrate across managed targets',
        description: 'genx migrate --managed',
      },
      {
        label: 'Sync deps (interactive package selection)',
        description: 'genx deps',
      },
      {
        label: 'Add features to current directory',
        description: 'genx features',
      },
      {
        label: 'Audit features and apply missing ones',
        description: 'genx audit',
      },
      {
        label: 'Run deps across managed targets',
        description: 'genx deps --managed',
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
