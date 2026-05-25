import { createFlowContext } from '@finografic/cli-kit/flow';
import { infoMessage, intro } from 'utils';

import { runManagedLoop } from 'lib/managed/managed-loop.runner';
import { promptFeatures } from 'lib/prompts/features.prompt';
import { isDevelopment } from 'utils/env.utils';

import { applyFeaturesToTarget } from '../features/features.cli.js';

export async function runManagedFeaturesFlow(argv: string[]): Promise<void> {
  intro('Managed features across @finografic packages');

  const debug = isDevelopment() || process.env.FINOGRAFIC_DEBUG === '1';
  if (debug) {
    infoMessage(`execPath: ${process.execPath}`);
    infoMessage(`argv[1]: ${process.argv[1] ?? ''}`);
  }

  const flow = createFlowContext(argv, { y: { type: 'boolean' } });

  const selectedFeatureIds = await promptFeatures(flow);
  if (!selectedFeatureIds || selectedFeatureIds.length === 0) {
    process.exit(0);
  }

  await runManagedLoop({
    yesMode: flow.yesMode,
    actionLabel: 'Add features to',
    runTarget: async (target) => {
      await applyFeaturesToTarget(target.path, selectedFeatureIds);
    },
  });
}
