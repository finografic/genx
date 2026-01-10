import { defaultHelpOptions } from 'config/help.config';
import type { HelpConfig } from 'types/help.types';

export const rootHelp: HelpConfig = {
  main: {
    bin: 'finografic-create',
    args: '<command> [options]',
  },

  commands: {
    title: 'Commands',
    list: [
      { label: 'create', description: 'Scaffold a new @finografic package' },
      { label: 'migrate', description: 'Sync conventions to an existing package' },
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
      { label: 'Create a new package', description: 'finografic-create create' },
      { label: 'Migrate current directory (dry-run)', description: 'finografic-create migrate' },
      {
        label: 'Migrate a specific directory (apply changes)',
        description: 'finografic-create migrate ../my-package --write',
      },
      {
        label: 'Migrate only specific sections',
        description: 'finografic-create migrate --only=package-json,eslint --write',
      },
    ],
  },

  footer: {
    title: 'Show Help',
    list: [
      { label: 'finografic-create help', description: '' },
      { label: 'finografic-create <command> --help', description: '' },
    ],
  },

  minWidth: defaultHelpOptions.minWidth,
};
