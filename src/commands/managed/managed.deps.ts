import process from 'node:process';
import { errorMessage, GENX_CONFIG_PATH, intro, isYesMode } from 'utils';

import { runManagedLoop } from 'lib/managed/managed-loop.runner';
import { pc } from 'utils/picocolors';
import { runPolicyUpdate } from 'utils/policy-update.utils';

import { syncDepsForTarget } from '../deps/deps.cli.js';

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
    runTarget: async (target) => {
      await syncDepsForTarget(target.path, { allowDowngrade, yesMode });
    },
  });
}
