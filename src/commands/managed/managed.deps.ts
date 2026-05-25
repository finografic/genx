import { intro, isYesMode } from 'utils';

import { runManagedLoop } from 'lib/managed/managed-loop.runner';
import { runPolicyUpdate } from 'utils/policy-update.utils';

import { syncDepsForTarget } from '../deps/deps.cli.js';

export async function runManagedDepsFlow(argv: string[]): Promise<void> {
  console.log('');
  intro('Managed deps sync across @finografic packages');

  const yesMode = isYesMode(argv);
  const allowDowngrade = argv.includes('--allow-downgrade');

  await runPolicyUpdate(true);

  await runManagedLoop({
    yesMode,
    actionLabel: 'Sync dependencies for',
    runTarget: async (target) => {
      await syncDepsForTarget(target.path, { allowDowngrade, yesMode });
    },
  });
}
