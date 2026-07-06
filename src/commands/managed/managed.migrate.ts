import { createFlowContext } from '@finografic/cli-kit/flow';
import { infoMessage, intro } from 'utils';
import type { FeatureId } from 'features/feature.types';

import { runManagedLoop } from 'lib/managed/managed-loop.runner';
import { promptFeatures } from 'lib/prompts/features.prompt';
import { isDevelopment } from 'utils/env.utils';

import type { MigrateOnlySection } from 'types/migrate.types';

import { promptMigrateOperations } from '../migrate/lib/migrate-operations.prompt.js';
import { upgradeSingleTarget } from '../migrate/migrate.cli.js';

export async function runManagedUpgradeFlow(argv: string[]): Promise<void> {
  intro('Managed upgrade across @finografic packages');

  const debug = isDevelopment() || process.env.FINOGRAFIC_DEBUG === '1';
  if (debug) {
    infoMessage(`execPath: ${process.execPath}`);
    infoMessage(`argv[1]: ${process.argv[1] ?? ''}`);
  }

  const flow = createFlowContext(argv, { y: { type: 'boolean' } });

  const selectedOperations = new Set<MigrateOnlySection>(await promptMigrateOperations(flow));
  const selectedFeatureIds: FeatureId[] = await promptFeatures(flow);

  if (selectedOperations.size === 0 && selectedFeatureIds.length === 0) {
    infoMessage('No upgrade operations or features selected.');
    return;
  }

  await runManagedLoop({
    yesMode: flow.yesMode,
    actionLabel: 'Upgrade',
    runTarget: async (target) => {
      await upgradeSingleTarget({
        targetDir: target.path,
        selectedOperations,
        debug,
        selectedFeatureIds,
      });
    },
  });
}
