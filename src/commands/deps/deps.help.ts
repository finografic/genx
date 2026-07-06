import type { CommandHelpConfig } from '@finografic/cli-kit/render-help';

type ReadmeCommandHelpConfig = CommandHelpConfig & {
  readmeDemo?: { alt: string; src: string; width?: number };
};

export const help: ReadmeCommandHelpConfig = {
  command: 'genx deps',
  description: 'Sync package dependencies to @finografic/deps-policy',
  readmeDemo: {
    alt: 'genx deps demo',
    src: './docs/genx-deps.gif',
    width: 988,
  },
  usage: 'genx deps [path] [options]',
  options: [
    { flag: '-y, --yes', description: 'Apply all planned changes without prompting' },
    { flag: '--allow-downgrade', description: 'Include policy downgrades in the plan' },
    { flag: '--update-policy', description: 'Update deps-policy itself (no dep sync)' },
  ],
  examples: [
    { command: 'genx deps', description: 'Interactive sync in current directory' },
    { command: 'genx deps ../my-package', description: 'Sync deps for a specific directory' },
    { command: 'genx deps --yes', description: 'Apply all changes non-interactively' },
    { command: 'genx deps --allow-downgrade', description: 'Include downgrades when planning' },
    { command: 'genx deps --update-policy', description: 'Update @finografic/deps-policy' },
  ],
  howItWorks: [
    'Reads policy versions from @finografic/deps-policy',
    'Compares against local package.json dependencies',
    'Shows a table of planned upgrades and downgrades for installed dependencies',
    'Prompts to select packages (or applies all with --yes)',
    'Runs pnpm install and syncs toolchain versions (.nvmrc, engines, packageManager)',
  ],
};
