import type { CommandHelpConfig } from '@finografic/cli-kit/render-help';

export const help: CommandHelpConfig = {
  command: 'genx features',
  description: 'Add optional features to an existing @finografic package',
  usage: 'genx features [path] [options]',
  options: [{ flag: '-y, --yes', description: 'Skip per-file confirmation prompts' }],
  examples: [
    { command: 'genx features', description: 'Add features to current directory' },
    { command: 'genx features ../my-package', description: 'Add features to a specific directory' },
    { command: 'genx features --yes', description: 'Apply without per-file confirms' },
  ],
  howItWorks: [
    'Prompts to select from available features (oxc-config, css, git-hooks, etc.)',
    'Detects already-installed features and skips them',
    'Shows a diff preview for each changed file before writing',
    'Runs pnpm install when dependencies change',
  ],
};
