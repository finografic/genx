import { createFlowContext } from '@finografic/cli-kit/flow';
import { withHelp } from '@finografic/cli-kit/render-help';
import { errorMessage, hasManagedFlag, infoMessage, intro, warnMessage } from 'utils';
import type { FeatureId } from 'features/feature.types';

import { runAgentDocsMigration } from './lib/agent-docs.runner.js';
import { restructureDocs } from './lib/docs-restructure.utils.js';
import { applyUpgradeTarget } from './lib/upgrade-apply.runner.js';
import { parseUpgradeArgs } from './lib/upgrade-metadata.utils.js';
import { promptUpgradeMode } from './lib/upgrade-mode.prompt.js';
import { promptUpgradeOperations } from './lib/upgrade-operations.prompt.js';
import { createUpgradeTargetContext } from './lib/upgrade-target-context.js';
import { runManagedLoop } from 'lib/managed/managed-loop.runner';
import { promptFeatures } from 'lib/prompts/features.prompt';
import { isDevelopment } from 'utils/env.utils';

import type { UpgradeOnlySection } from 'types/upgrade.types';

import { help } from './upgrade.help.js';

export async function upgradePackage(argv: string[], context: { cwd: string }): Promise<void> {
  return withHelp(argv, help, async () => {
    intro('Upgrade existing @finografic package');

    const debug = isDevelopment() || process.env.FINOGRAFIC_DEBUG === '1';
    if (debug) {
      infoMessage(`execPath: ${process.execPath}`);
      infoMessage(`argv[1]: ${process.argv[1] ?? ''}`);
    }

    const flow = createFlowContext(argv, { y: { type: 'boolean' } });
    const managed = hasManagedFlag(argv);
    const { targetDir } = parseUpgradeArgs(argv, context.cwd);

    if (managed) {
      warnMessage('--managed is deprecated. Use: genx managed upgrade');
    }

    if (managed && targetDir !== context.cwd) {
      errorMessage('Cannot combine [path] with --managed');
      process.exit(1);
      return;
    }

    const selectedOperations = new Set<UpgradeOnlySection>(await promptUpgradeOperations(flow));
    if (selectedOperations.size === 0 && !managed) {
      const mode = await promptUpgradeMode();
      if (!mode) {
        process.exit(0);
        return;
      }

      if (mode === 'agent-docs') {
        await runAgentDocsMigration(targetDir, flow.yesMode);
        return;
      }
    }

    const selectedFeatureIds = await promptFeatures(flow);
    if (selectedOperations.size === 0 && selectedFeatureIds.length === 0) {
      infoMessage('No upgrade operations or features selected.');
      return;
    }

    if (managed) {
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
      return;
    }

    await upgradeSingleTarget({
      targetDir,
      selectedOperations,
      debug,
      selectedFeatureIds,
    });
  });
}

export async function upgradeSingleTarget(params: {
  targetDir: string;
  selectedOperations: Set<UpgradeOnlySection>;
  debug: boolean;
  selectedFeatureIds: FeatureId[];
}): Promise<void> {
  const context = await createUpgradeTargetContext({
    targetDir: params.targetDir,
    only: params.selectedOperations,
    debug: params.debug,
    selectedFeatureIds: params.selectedFeatureIds,
  });
  if (!context) {
    return;
  }

  await restructureDocs(context.targetDir, params.selectedOperations);
  await applyUpgradeTarget({
    context,
    only: params.selectedOperations,
    selectedFeatureIds: params.selectedFeatureIds,
  });
}
