import { homedir } from 'node:os';
import process from 'node:process';
import { errorMessage, GENX_CONFIG_PATH, infoMessage, intro, isYesMode } from 'utils';

import { runManagedLoop } from 'lib/managed/managed-loop.runner';
import { pc } from 'utils/picocolors';
import { runPolicyUpdate } from 'utils/policy-update.utils';

import { syncDepsForTarget, targetHasPendingChanges } from '../deps/deps.cli.js';

export async function runManagedDepsFlow(argv: string[]): Promise<void> {
  console.log('');
  intro('Managed deps sync across @finografic packages');

  const yesMode = isYesMode(argv);
  const allowDowngrade = argv.includes('--allow-downgrade');
  const updatePolicy = argv.includes('--update-policy');

  if (updatePolicy) {
    const found = await runPolicyUpdate(true);
    if (!found) {
      errorMessage(
        `depsPolicyPath not set in config.\nAdd it to ${pc.cyan(GENX_CONFIG_PATH)} to use --update-policy.`,
      );
      process.exit(1);
    }
  }

  await runManagedLoop({
    yesMode,
    actionLabel: 'Sync dependencies for',
    // Plan before offering. Most repos in a managed run need nothing, and asking about every one
    // of them buries the few that do.
    hasPendingWork: async (target) => {
      if (await targetHasPendingChanges(target.path, { allowDowngrade })) return true;

      infoMessage(`\n${pc.cyan(target.path.replace(homedir(), ''))}`);
      infoMessage(pc.white('All dependencies and toolchain versions already aligned with policy.'));
      return false;
    },
    runTarget: async (target) => {
      await syncDepsForTarget(target.path, { allowDowngrade, yesMode });
    },
  });
}
