import { rename } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import * as clack from '@clack/prompts';
import { shouldRunSection } from 'migrate/migrate-metadata.utils';

import { copyDir, copyTemplate, ensureDir, fileExists, infoMessage } from 'utils';
import { migrateConfig } from 'config/migrate.config';
import { renameRules } from 'config/rename.rules';
import type { MigrateOnlySection } from 'types/migrate.types';
import type { TemplateVars } from 'types/template.types';

/**
 * Sync files from template to target directory.
 */
export async function syncFromTemplate(
  targetDir: string,
  templateDir: string,
  vars: TemplateVars,
  only: Set<MigrateOnlySection> | null,
): Promise<void> {
  const syncTasks = migrateConfig.syncFromTemplate.filter((item) =>
    shouldRunSection(only, item.section),
  );

  if (syncTasks.length === 0) {
    return;
  }

  const syncSpin = clack.spinner();
  syncSpin.start(`Syncing ${syncTasks.length} file(s) from template...`);

  for (const item of syncTasks) {
    const sourcePath = resolve(templateDir, item.templatePath);
    const destinationPath = resolve(targetDir, item.targetPath);

    // Special handling for eslint.config.ts: backup existing alternatives first
    if (item.targetPath === 'eslint.config.ts') {
      const eslintRule = renameRules.find((rule) => rule.canonical === 'eslint.config.ts');
      if (eslintRule) {
        const filesToCheck = [...eslintRule.alternatives, eslintRule.canonical];

        for (const file of filesToCheck) {
          const filePath = resolve(targetDir, file);
          if (fileExists(filePath)) {
            const ext = file.includes('.') ? file.split('.').pop() : 'mjs';
            const backupPath = resolve(targetDir, `eslint.config--backup.${ext}`);
            await rename(filePath, backupPath);
            infoMessage(`Backed up ${file} to eslint.config--backup.${ext}`);
          }
        }
      }
    }

    // Directory copy
    if (item.templatePath === 'docs') {
      await ensureDir(destinationPath);
      await copyDir(sourcePath, destinationPath, vars);
      continue;
    }

    // Ensure destination directory exists
    await ensureDir(dirname(destinationPath));
    await copyTemplate(sourcePath, destinationPath, vars);
  }

  syncSpin.stop(`Synced ${syncTasks.length} file(s)`);
}

/**
 * Copy LICENSE file from template if missing.
 */
export async function copyLicenseIfMissing(
  targetDir: string,
  templateDir: string,
  vars: TemplateVars,
  shouldCopy: boolean,
): Promise<void> {
  if (!shouldCopy) {
    return;
  }

  const licenseSourcePath = resolve(templateDir, 'LICENSE');
  const licenseDestPath = resolve(targetDir, 'LICENSE');
  await copyTemplate(licenseSourcePath, licenseDestPath, vars);
}
