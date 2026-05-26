import type { CommandHelpConfig } from '@finografic/cli-kit/render-help';

export const help: CommandHelpConfig = {
  command: 'genx migrate',
  description: 'Sync conventions to an existing @finografic package',
  usage: 'genx migrate [path] [options]',
  options: [{ flag: '-y, --yes', description: 'Skip per-file confirmation prompts' }],
  examples: [
    { command: 'genx migrate', description: 'Migrate current directory interactively' },
    { command: 'genx migrate ../my-package', description: 'Migrate a specific directory' },
    { command: 'genx migrate --yes', description: 'Apply changes without per-file confirms' },
  ],
  howItWorks: [
    'Select migrate operations (package.json, config, agent docs, etc.)',
    'Optionally select features to apply alongside migration',
    'Shows a diff preview for each changed file before writing',
    'Applies selected changes to the target directory',
  ],
};
