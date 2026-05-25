import { GENX_CONFIG_PATH, errorMessage, infoMessage, readManagedTargets, successMessage } from 'utils';

import { pc } from 'utils/picocolors';

import type { ManagedTarget } from 'types/managed.types';

import { promptManagedTargetAction } from './managed.prompt.js';

export async function runManagedLoop(params: {
  yesMode: boolean;
  actionLabel: string;
  runTarget: (target: ManagedTarget) => Promise<void>;
}): Promise<void> {
  let managedTargets: ManagedTarget[];
  try {
    managedTargets = await readManagedTargets();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to read managed config';
    errorMessage(`${message}\nExpected config: ${pc.cyan(GENX_CONFIG_PATH)}`);
    process.exit(1);
    return;
  }

  if (managedTargets.length === 0) {
    infoMessage(`No managed targets found in ${pc.cyan(GENX_CONFIG_PATH)}`);
    return;
  }

  let appliedCount = 0;
  let skippedCount = 0;

  for (const [index, target] of managedTargets.entries()) {
    if (!params.yesMode) {
      const action = await promptManagedTargetAction({
        actionLabel: params.actionLabel,
        target,
        currentIndex: index + 1,
        total: managedTargets.length,
      });

      if (action === null) {
        process.exit(0);
        return;
      }

      if (action === 'skip') {
        skippedCount += 1;
        continue;
      }
    }

    await params.runTarget(target);
    appliedCount += 1;
  }

  successMessage(
    `Managed run complete (${appliedCount} processed${skippedCount > 0 ? `, ${skippedCount} skipped` : ''})`,
  );
}
