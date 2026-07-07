import { dirname, resolve } from 'node:path';
import * as clack from '@clack/prompts';
import { copyDir, copyTemplate, ensureDir } from 'utils';

import { isCliPackage } from 'lib/generators/cli-help.generator';

import { upgradeConfig } from 'config/upgrade.config';
import type { TemplateVars } from 'types/template.types';
import type { UpgradeOnlySection } from 'types/upgrade.types';

import { shouldRunSection } from './upgrade-metadata.utils.js';

/**
 * Sync files from template to target directory.
 *
 * `packageJson` is used to omit `docs/spec/` (CLI core spec snapshot) when the target is not a CLI package.
 */
export async function syncFromTemplate(
  targetDir: string,
  templateDir: string,
  vars: TemplateVars,
  only: Set<UpgradeOnlySection> | null,
  packageJson: Record<string, unknown>,
): Promise<void> {
  const syncTasks = upgradeConfig.syncFromTemplate.filter((item) => shouldRunSection(only, item.section));

  if (syncTasks.length === 0) {
    return;
  }

  const syncSpin = clack.spinner();
  syncSpin.start(`Syncing ${syncTasks.length} file(s) from template...`);

  for (const item of syncTasks) {
    const sourcePath = resolve(templateDir, item.templatePath);
    const destinationPath = resolve(targetDir, item.targetPath);

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
