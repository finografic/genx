import { promptMultiSelect } from '@finografic/cli-kit/flow';
import type { FlowContext } from '@finografic/cli-kit/flow';

import type { UpgradeOnlySection } from 'types/upgrade.types';

const UPGRADE_OPERATION_OPTIONS: Array<{
  value: UpgradeOnlySection;
  label: string;
  hint?: string;
}> = [
  { value: 'package-json', label: 'package-json', hint: 'scripts, lint-staged, keywords' },
  { value: 'dependencies', label: 'dependencies', hint: 'align versions to deps-policy' },
  { value: 'node', label: 'node', hint: '.nvmrc, CI node version, @types/node' },
  { value: 'renames', label: 'renames', hint: 'normalize canonical filenames' },
  { value: 'hooks', label: 'hooks', hint: 'husky and commitlint files' },
  { value: 'workflows', label: 'workflows', hint: 'GitHub CI and release workflows' },
  { value: 'docs', label: 'docs', hint: 'docs and .env.example sync' },
  {
    value: 'gitignore',
    label: 'gitignore',
    hint: 'canonical .gitignore from template; keep # Project-specific extras',
  },
];

const DEFAULT_UPGRADE_OPERATIONS = UPGRADE_OPERATION_OPTIONS.map((option) => option.value);

export async function promptUpgradeOperations(flow: FlowContext): Promise<UpgradeOnlySection[]> {
  const selected = await promptMultiSelect(flow, {
    message: 'Select upgrade operations:',
    options: UPGRADE_OPERATION_OPTIONS,
    initialValues: DEFAULT_UPGRADE_OPERATIONS,
  });

  // `merges` is package.json only (see config/merge.rules.ts), so it is not offered as its own
  // operation: leaving it selectable meant deselecting `package-json` did not protect package.json.
  // It rides with `package-json` here and stays reachable explicitly via `--only merges`.
  return selected.includes('package-json') ? [...selected, 'merges'] : selected;
}
