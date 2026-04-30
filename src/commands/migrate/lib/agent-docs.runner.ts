import * as clack from '@clack/prompts';
import { errorMessage, infoMessage, spinner, successUpdatedMessage } from 'utils';

import { pc } from 'utils/picocolors';

import { isAgentDocsAlreadyMigrated, migrateAgentDocs } from './agent-docs-migration.js';

export async function runAgentDocsMigration(targetDir: string, yesMode: boolean): Promise<void> {
  if (!yesMode) {
    const confirmed = await clack.confirm({
      message: `Migrate AI agent docs for ${pc.cyan(targetDir)}?`,
      initialValue: true,
    });

    if (clack.isCancel(confirmed) || !confirmed) {
      process.exit(0);
      return;
    }
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
