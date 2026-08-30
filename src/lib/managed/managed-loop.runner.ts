import { GENX_CONFIG_PATH, errorMessage, infoMessage, readManagedTargets, successMessage } from 'utils';

import { pc } from 'utils/picocolors';

import type { ManagedTarget } from 'types/managed.types';

import { promptManagedTargetAction } from './managed.prompt.js';

export async function runManagedLoop(params: {
  yesMode: boolean;
  actionLabel: string;
  runTarget: (target: ManagedTarget) => Promise<void>;
  /**
   * Optional pre-check, run before a target is offered.
   *
   * Return false for a target with nothing to do: it is then neither prompted for nor run.
   * Prompting about a repo that needs nothing is how a long managed run teaches you to press
   * Enter without reading it.
   *
   * Reporting is the caller's job, since only the caller knows what "nothing to do" means for
   * its flow — print whatever explanation fits before returning false.
   */
  hasPendingWork?: (target: ManagedTarget) => Promise<boolean>;
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
  let alignedCount = 0;

  for (const [index, target] of managedTargets.entries()) {
    if (params.hasPendingWork && !(await params.hasPendingWork(target))) {
      alignedCount += 1;
      continue;
    }

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

  const summary = [
    `${appliedCount} processed`,
    ...(alignedCount > 0 ? [`${alignedCount} already aligned`] : []),
    ...(skippedCount > 0 ? [`${skippedCount} skipped`] : []),
  ].join(', ');
  successMessage(`Managed run complete (${summary})`);
}
