import * as clack from '@clack/prompts';
import { errorMessage, infoMessage, spinner, successUpdatedMessage } from 'utils';

import { pc } from 'utils/picocolors';

import { isAgentDocsAlreadyMigrated, migrateAgentDocs } from './agent-docs-migration.js';

export async function runAgentDocsMigration(targetDir: string, write: boolean): Promise<void> {
  if (!write) {
    const plan = await migrateAgentDocs(targetDir, { dryRun: true });
    infoMessage(`${pc.green('DRY RUN.')} ${pc.white('Planned changes for:')}\n${pc.cyan(targetDir)}`);
    for (const line of plan.applied) {
      clack.log.info(`- ${line}`);
    }
    for (const line of plan.skipped) {
      clack.log.info(pc.dim(`- skip: ${line}`));
    }
    infoMessage(`${pc.white('Re-run with')} ${pc.yellow('--write')} ${pc.white('to apply changes.')}\n\n`);
    return;
  }

  if (isAgentDocsAlreadyMigrated(targetDir)) {
    infoMessage('AI agent docs already in canonical structure. No changes needed.');
    return;
  }

  const spin = spinner();
  spin.start('Migrating AI agent docs...');
  const result = await migrateAgentDocs(targetDir, { dryRun: false });
  spin.stop('Done');

  if (result.errors.length > 0) {
    for (const err of result.errors) errorMessage(err);
  }
  if (result.applied.length > 0) {
    successUpdatedMessage(`Updated ${result.applied.length} item(s)`);
  } else {
    infoMessage('Nothing to change.');
  }
}
