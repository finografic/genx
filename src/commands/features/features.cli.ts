import { createFlowContext } from '@finografic/cli-kit/flow';
import { withHelp } from '@finografic/cli-kit/render-help';
import {
  GENX_CONFIG_PATH,
  errorMessage,
  getPathArg,
  hasManagedFlag,
  infoMessage,
  intro,
  outro,
  readManagedTargets,
  resolveTargetDir,
  warnMessage,
} from 'utils';

import { applyFeaturesToTarget, logFeatureResults } from 'lib/features/apply-features.runner';
import { promptManagedTargetAction } from 'lib/managed/managed.prompt';
import { promptFeatures } from 'lib/prompts/features.prompt';
import { isDevelopment } from 'utils/env.utils';
import { pc } from 'utils/picocolors';
import { validateExistingPackage } from 'utils/validation.utils';

import type { ManagedTarget } from 'types/managed.types';

import { help } from './features.help.js';

/**
 * Add optional features to an existing @finografic package.
 */
export async function addFeatures(argv: string[], options: { targetDir: string }): Promise<void> {
  return withHelp(argv, help, async () => {
    intro('Add features to existing @finografic package');

    const debug = isDevelopment() || process.env.FINOGRAFIC_DEBUG === '1';
    if (debug) {
      infoMessage(`execPath: ${process.execPath}`);
      infoMessage(`argv[1]: ${process.argv[1] ?? ''}`);
    }

    const flow = createFlowContext(argv, { y: { type: 'boolean' } });

    // 1. Validate arguments
    const managed = hasManagedFlag(argv);
    const pathArg = getPathArg(argv);

    if (managed && pathArg) {
      errorMessage('Cannot combine [path] with --managed');
      process.exit(1);
      return;
    }

    if (managed) {
      warnMessage('--managed is deprecated. Use: genx managed features');
      let managedTargets: ManagedTarget[];
      try {
        managedTargets = await readManagedTargets();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to read managed config';
        errorMessage(`${message}\nExpected config: ${pc.cyan(GENX_CONFIG_PATH)}`);
        process.exit(1);
      }

      if (managedTargets.length === 0) {
        infoMessage(`No managed targets found in ${pc.cyan(GENX_CONFIG_PATH)}`);
        return;
      }

      const selectedFeatureIds = await promptFeatures(flow);
      if (!selectedFeatureIds) {
        process.exit(0);
      }

      let appliedCount = 0;
      let skippedCount = 0;

      for (const [index, target] of managedTargets.entries()) {
        if (!flow.yesMode) {
          const action = await promptManagedTargetAction({
            actionLabel: 'Add features to',
            target,
            currentIndex: index + 1,
            total: managedTargets.length,
          });

          if (action === null) {
            process.exit(0);
          }

          if (action === 'skip') {
            skippedCount += 1;
            continue;
          }
        }

        const results = await applyFeaturesToTarget(target.path, selectedFeatureIds, {
          commandName: 'managed features',
        });
        logFeatureResults(results);
        appliedCount += 1;
      }

      outro(
        `Managed run complete (${appliedCount} processed${skippedCount > 0 ? `, ${skippedCount} skipped` : ''})`,
      );
      return;
    }

    const targetDir = resolveTargetDir(options.targetDir, pathArg);
    const validation = validateExistingPackage(targetDir);
    if (!validation.ok) {
      errorMessage(validation.reason || 'Not a valid package directory');
      process.exit(1);
    }

    // 2. Prompt for features
    const selectedFeatureIds = await promptFeatures(flow);
    if (!selectedFeatureIds) {
      process.exit(0);
    }

    // 3. Apply selected features
    const results = await applyFeaturesToTarget(targetDir, selectedFeatureIds, { commandName: 'features' });
    logFeatureResults(results);
    outro('Feature run complete');
  });
}
