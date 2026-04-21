import { rename } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import * as clack from '@clack/prompts';
import { copyDir, copyTemplate, ensureDir, fileExists, infoMessage } from 'utils';

import { isCliPackage } from 'lib/generators/cli-help.generator';
import { shouldRunSection } from 'lib/migrate/migrate-metadata.utils';

import { migrateConfig } from 'config/migrate.config';
import { renameRules } from 'config/rename.rules';
import type { MigrateOnlySection } from 'types/migrate.types';
import type { TemplateVars } from 'types/template.types';

/**
 * Sync files from template to target directory.
 *
 * `packageJson` is used to omit `docs/spec/` (CLI core spec snapshot) when the target is not a CLI package.
 */
export async function syncFromTemplate(
  targetDir: string,
  templateDir: string,
  vars: TemplateVars,
  only: Set<MigrateOnlySection> | null,
  packageJson: Record<string, unknown>,
): Promise<void> {
  const syncTasks = migrateConfig.syncFromTemplate.filter((item) => shouldRunSection(only, item.section));

  if (syncTasks.length === 0) {
    return;
  }

  const syncSpin = clack.spinner();
  syncSpin.start(`Syncing ${syncTasks.length} file(s) from template...`);

  for (const item of syncTasks) {
    const sourcePath = resolve(templateDir, item.templatePath);
    const destinationPath = resolve(targetDir, item.targetPath);

    // Special handling for oxlint.config.ts: backup existing file before template sync
    if (item.targetPath === 'oxlint.config.ts') {
      const oxlintRule = renameRules.find((rule) => rule.canonical === 'oxlint.config.ts');
      if (oxlintRule) {
        const filesToCheck = [...oxlintRule.alternatives, oxlintRule.canonical];

        for (const file of filesToCheck) {
          const filePath = resolve(targetDir, file);
          if (fileExists(filePath)) {
            const ext = file.includes('.') ? file.split('.').pop() : 'ts';
            const backupPath = resolve(targetDir, `oxlint.config--backup.${ext}`);
            await rename(filePath, backupPath);
            infoMessage(`Backed up ${file} to oxlint.config--backup.${ext}`);
          }
        }
      }
    }

    // Directory copy — `docs/spec/` is only for CLI packages (see docs/spec/CLI_CORE.md)
    if (item.templatePath === 'docs') {
      await ensureDir(destinationPath);
      const ignoreSpec = isCliPackage(packageJson) ? [] : ['spec'];
      await copyDir(sourcePath, destinationPath, vars, { ignore: ignoreSpec });
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
