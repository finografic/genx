import * as clack from '@clack/prompts';

import { pc } from 'utils/picocolors';
import { cancel } from 'utils/prompts.utils';

import type { ManagedTarget } from 'types/managed.types';

export async function promptManagedTargetAction(params: {
  actionLabel: string;
  target: ManagedTarget;
  currentIndex: number;
  total: number;
}): Promise<'apply' | 'skip' | null> {
  const choice = await clack.select({
    message: `${params.actionLabel} ${pc.cyan(params.target.name)} ${pc.dim(
      `(${params.currentIndex}/${params.total})`,
    )}\n${pc.dim(params.target.path)}`,
    options: [
      { value: 'apply', label: 'Apply' },
      { value: 'skip', label: 'Skip' },
      { value: 'cancel', label: 'Cancel run' },
    ],
    initialValue: 'apply',
  });

  if (clack.isCancel(choice) || choice === 'cancel') {
    return cancel();
  }

  if (choice === 'apply' || choice === 'skip') {
    return choice;
  }

  return cancel();
}
