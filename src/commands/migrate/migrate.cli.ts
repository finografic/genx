import { createFlowContext } from '@finografic/cli-kit/flow';
import { withHelp } from '@finografic/cli-kit/render-help';
import { errorMessage, hasManagedFlag, infoMessage, intro, warnMessage } from 'utils';
import type { FeatureId } from 'features/feature.types';

import { runAgentDocsMigration } from './lib/agent-docs.runner.js';
import { restructureDocs } from './lib/docs-restructure.utils.js';
import { applyMigrateTarget } from './lib/migrate-apply.runner.js';
import { parseMigrateArgs } from './lib/migrate-metadata.utils.js';
import { promptMigrateMode } from './lib/migrate-mode.prompt.js';
import { promptMigrateOperations } from './lib/migrate-operations.prompt.js';
import { createMigrateTargetContext } from './lib/migrate-target-context.js';
import { runManagedLoop } from 'lib/managed/managed-loop.runner';
import { promptFeatures } from 'lib/prompts/features.prompt';
import { isDevelopment } from 'utils/env.utils';

import type { MigrateOnlySection } from 'types/migrate.types';

import { help } from './migrate.help.js';

export async function migratePackage(argv: string[], context: { cwd: string }): Promise<void> {
  return withHelp(argv, help, async () => {
    intro('Migrate existing @finografic package');

    const debug = isDevelopment() || process.env.FINOGRAFIC_DEBUG === '1';
    if (debug) {
      infoMessage(`execPath: ${process.execPath}`);
      infoMessage(`argv[1]: ${process.argv[1] ?? ''}`);
    }

    const flow = createFlowContext(argv, { y: { type: 'boolean' } });
    const managed = hasManagedFlag(argv);
    const { targetDir } = parseMigrateArgs(argv, context.cwd);

    if (managed) {
      warnMessage('--managed is deprecated. Use: genx managed migrate');
    }

    if (managed && targetDir !== context.cwd) {
      errorMessage('Cannot combine [path] with --managed');
      process.exit(1);
      return;
    }

    const selectedOperations = new Set<MigrateOnlySection>(await promptMigrateOperations(flow));
    if (selectedOperations.size === 0 && !managed) {
      const mode = await promptMigrateMode();
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
      infoMessage('No migrate operations or features selected.');
      return;
    }

    if (managed) {
      await runManagedLoop({
        yesMode: flow.yesMode,
        actionLabel: 'Migrate',
        runTarget: async (target) => {
          await migrateSingleTarget({
            targetDir: target.path,
            selectedOperations,
            debug,
            selectedFeatureIds,
          });
        },
      });
      return;
    }

    await migrateSingleTarget({
      targetDir,
      selectedOperations,
      debug,
      selectedFeatureIds,
    });
  });
}

export async function migrateSingleTarget(params: {
  targetDir: string;
  selectedOperations: Set<MigrateOnlySection>;
  debug: boolean;
  selectedFeatureIds: FeatureId[];
}): Promise<void> {
  const context = await createMigrateTargetContext({
    targetDir: params.targetDir,
    only: params.selectedOperations,
    debug: params.debug,
    selectedFeatureIds: params.selectedFeatureIds,
  });
  if (!context) {
    return;
  }

  await restructureDocs(context.targetDir, params.selectedOperations);
  await applyMigrateTarget({
    context,
    only: params.selectedOperations,
    selectedFeatureIds: params.selectedFeatureIds,
  });
}
