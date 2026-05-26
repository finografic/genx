import type { CommandHelpConfig } from '@finografic/cli-kit/render-help';

export const help: CommandHelpConfig = {
  command: 'genx audit',
  description: 'Scan features and apply what is missing or partial',
  usage: 'genx audit [path] [options]',
  options: [{ flag: '-y, --yes', description: 'Apply selected features without per-file confirms' }],
  examples: [
    { command: 'genx audit', description: 'Audit current directory' },
    { command: 'genx audit ../my-package', description: 'Audit a specific directory' },
    { command: 'genx audit -y', description: 'Apply without per-file confirms' },
  ],
  howItWorks: [
    'Scans all known features against the target package',
    'Reports installed, partial, and missing features',
    'Prompts to select partial/missing features to apply',
    'Applies selected features with diff preview',
  ],
};
