import { createFlowContext } from '@finografic/cli-kit/flow';
import { withHelp } from '@finografic/cli-kit/render-help';
import { errorMessage, hasManagedFlag, infoMessage, intro } from 'utils';
import type { FeatureId } from 'features/feature.types';

import { runAgentDocsMigration } from './lib/agent-docs.runner.js';
import { restructureDocs } from './lib/docs-restructure.utils.js';
import { runManagedMigrate } from './lib/managed-migrate.runner.js';
import { applyMigrateTarget } from './lib/migrate-apply.runner.js';
import { renderMigrateDryRun } from './lib/migrate-dry-run.output.js';
import { parseMigrateArgs } from './lib/migrate-metadata.utils.js';
import { promptMigrateMode } from './lib/migrate-mode.prompt.js';
import { createMigrateTargetContext } from './lib/migrate-target-context.js';
import { promptFeatures } from 'lib/prompts/features.prompt';
import { isDevelopment } from 'utils/env.utils';

import type { MigrateOnlySection } from 'types/migrate.types';
import { MIGRATE_ONLY_SECTIONS } from 'types/migrate.types';

import { help } from './migrate.help.js';

export async function migratePackage(argv: string[], context: { cwd: string }): Promise<void> {
  return withHelp(argv, help, async () => {
    intro('Migrate existing @finografic package');

    // Helpful debug info (always on in dev)
    const debug = isDevelopment() || process.env.FINOGRAFIC_DEBUG === '1';
    if (debug) {
      infoMessage(`execPath: ${process.execPath}`);
      infoMessage(`argv[1]: ${process.argv[1] ?? ''}`);
    }

    const flow = createFlowContext(argv, { y: { type: 'boolean' } });
    const managed = hasManagedFlag(argv);
    const { targetDir, write, only } = parseMigrateArgs(argv, context.cwd);

    if (managed && targetDir !== context.cwd) {
      errorMessage('Cannot combine [path] with --managed');
      process.exit(1);
      return;
    }

    if (only) {
      const invalid = [...only].filter((section) => !MIGRATE_ONLY_SECTIONS.includes(section));
      if (invalid.length > 0) {
        errorMessage(
          `Unknown --only section(s): ${invalid.join(', ')}. Valid values: ${MIGRATE_ONLY_SECTIONS.join(', ')}`,
        );
        process.exit(1);
        return;
      }
    }

    if (managed) {
      let selectedFeatureIds: FeatureId[] = [];
      if (!only) {
        const prompted = await promptFeatures(flow);
        if (!prompted) {
          process.exit(0);
          return;
        }
        selectedFeatureIds = prompted;
      }

      await runManagedMigrate({
        write,
        yesMode: flow.yesMode,
        actionLabel: 'Migrate',
        runTarget: async (target) => {
          await migrateSingleTarget({
            targetDir: target.path,
            write,
            only,
            debug,
            selectedFeatureIds,
          });
        },
      });
      return;
    }

    let selectedFeatureIds: FeatureId[] = [];
    if (!only) {
      const mode = await promptMigrateMode();
      if (!mode) {
        process.exit(0);
        return;
      }

      if (mode === 'agent-docs') {
        await runAgentDocsMigration(targetDir, write);
        return;
      }

      const prompted = await promptFeatures(flow);
      if (!prompted) {
        process.exit(0);
        return;
      }
      selectedFeatureIds = prompted;
    }

    await migrateSingleTarget({
      targetDir,
      write,
      only,
      debug,
      selectedFeatureIds,
    });
  });
}

async function migrateSingleTarget(params: {
  targetDir: string;
  write: boolean;
  only: Set<MigrateOnlySection> | null;
  debug: boolean;
  selectedFeatureIds: FeatureId[];
}): Promise<void> {
  const context = await createMigrateTargetContext({
    targetDir: params.targetDir,
    only: params.only,
    debug: params.debug,
    selectedFeatureIds: params.selectedFeatureIds,
  });
  if (!context) {
    return;
  }

  if (!params.write) {
    renderMigrateDryRun(context, params.only);
    return;
  }

  await restructureDocs(context.targetDir, params.only);
  await applyMigrateTarget({
    context,
    only: params.only,
    selectedFeatureIds: params.selectedFeatureIds,
  });
}
