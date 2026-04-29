import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import * as clack from '@clack/prompts';
import { infoMessage } from 'utils';
import type { MigrateTargetContext } from './migrate-target-context.js';

import { getBinName, isCliPackage } from 'lib/generators/cli-help.generator';
import { pc } from 'utils/picocolors';

import type { MigrateOnlySection } from 'types/migrate.types';

export function renderMigrateDryRun(
  context: MigrateTargetContext,
  only: Set<MigrateOnlySection> | null,
): void {
  infoMessage(`${pc.green('DRY RUN.')} ${pc.white('Planned changes for:')}\n${pc.cyan(context.targetDir)}`);
  for (const line of context.plan) {
    clack.log.info(`- ${line}`);
  }

  if (!only && isCliPackage(context.packageJson)) {
    const binName = getBinName(context.packageJson, context.parsed.name);
    const helpFilePath = resolve(context.targetDir, `src/${binName}.help.ts`);
    if (!existsSync(helpFilePath)) {
      clack.log.info(`- Would create src/${binName}.help.ts (CLI project)`);
    }
  }

  infoMessage(`${pc.white('Re-run with')} ${pc.yellow('--write')} ${pc.white('to apply changes.')}\n\n`);
}
