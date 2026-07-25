import type { CommandHelpConfig } from '@finografic/cli-kit/render-help';

export const help: CommandHelpConfig = {
  command: 'genx upgrade',
  description: 'Upgrade an existing @finografic package to current conventions',
  usage: 'genx upgrade [path] [options]',
  options: [
    { flag: '-y, --yes', description: 'Skip per-file confirmation prompts' },
    {
      flag: '--agent-docs',
      description: 'Sync AGENTS.md, .agents/instructions/, and .agents/skills/ non-interactively',
    },
  ],
  examples: [
    { command: 'genx upgrade', description: 'Upgrade current directory interactively' },
    { command: 'genx upgrade ../my-package', description: 'Upgrade a specific directory' },
    { command: 'genx upgrade --yes', description: 'Apply changes without per-file confirms' },
    { command: 'genx upgrade --agent-docs -y', description: 'Sync agent docs only, no prompts' },
  ],
  howItWorks: [
    'Select upgrade operations (package.json, gitignore, config, agent docs, etc.)',
    'Optionally select features to apply alongside the upgrade',
    'Shows a diff preview for each changed file before writing',
    'Applies selected changes to the target directory',
  ],
};
