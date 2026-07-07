import * as clack from '@clack/prompts';

export async function promptUpgradeMode(): Promise<'features' | 'agent-docs' | null> {
  const mode = await clack.select({
    message: 'What would you like to do?',
    options: [
      { value: 'features', label: 'Select optional features' },
      {
        value: 'agent-docs',
        label: 'Upgrade AI agent docs',
        hint: 'restructure .github/instructions/, AGENTS.md, CLAUDE.md',
      },
    ],
  });

  if (clack.isCancel(mode)) {
    return null;
  }

  return mode;
}
