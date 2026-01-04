import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as clack from '@clack/prompts';
import { parseMigrateArgs } from 'migrate/migrate-metadata.utils';
import pc from 'picocolors';
import { confirmMigrateTarget } from 'prompts/migrate.prompt';
import { getScopeAndName, shouldRunSection } from 'src/migrate/migrate-metadata.utils';
import { patchPackageJson, readPackageJson, writePackageJson } from 'src/migrate/package-json.utils';

import { copyDir, copyTemplate, ensureDir, errorMessage, findPackageRoot, getTemplatesPackageDir, infoMessage, intro, successMessage } from 'utils';
import { isDevelopment, safeExit } from 'utils/env.utils';
import { validateExistingPackage } from 'utils/validation.utils';
import { migrateConfig } from 'config/migrate.config';
import type { TemplateVars } from 'types/template.types';

export async function migratePackage(argv: string[], options: { cwd: string }): Promise<void> {
  intro('Migrate existing @finografic package');

  // Helpful debug info (always on in dev)
  const debug = isDevelopment() || process.env.FINOGRAFIC_DEBUG === '1';
  if (debug) {
    infoMessage(`execPath: ${process.execPath}`);
    infoMessage(`argv[1]: ${process.argv[1] ?? ''}`);
  }

  const { targetDir, write, only } = parseMigrateArgs(argv, options.cwd);

  const validation = validateExistingPackage(targetDir);
  if (!validation.ok) {
    errorMessage(validation.reason || 'Not a valid package directory');
    safeExit(1);
    return;
  }

  const packageJsonPath = resolve(targetDir, 'package.json');
  const packageJson = await readPackageJson(packageJsonPath);
  const parsed = getScopeAndName(packageJson.name);
  if (!parsed) {
    errorMessage('Unable to read package name from package.json');
    safeExit(1);
    return;
  }

  const ok = await confirmMigrateTarget({
    scope: parsed.scope,
    name: parsed.name,
    expectedScope: migrateConfig.defaultScope,
  });
  if (!ok) {
    safeExit(0);
    return;
  }

  const vars: TemplateVars = {
    SCOPE: parsed.scope,
    NAME: parsed.name,
    PACKAGE_NAME: `${parsed.scope}/${parsed.name}`,
    YEAR: new Date().getFullYear().toString(),
    // These might not exist in every repo; template system leaves unknown tokens as-is.
    DESCRIPTION: typeof packageJson.description === 'string' ? packageJson.description : '',
    AUTHOR_NAME: '',
    AUTHOR_EMAIL: '',
    AUTHOR_URL: '',
  };

  const plan: string[] = [];

  // package.json patch plan
  if (shouldRunSection(only, 'package-json')) {
    const { changes } = patchPackageJson(packageJson, parsed.name);
    if (changes.length > 0) {
      plan.push(`patch package.json: ${changes.join(', ')}`);
    } else {
      plan.push('package.json already aligned');
    }
  }

  // template sync plan
  const fromDir = fileURLToPath(new URL('.', import.meta.url));
  const packageRoot = findPackageRoot(fromDir);
  const templateDir = getTemplatesPackageDir(fromDir);

  if (debug) {
    infoMessage(`importMetaDir: ${fromDir}`);
    infoMessage(`packageRoot: ${packageRoot}`);
    infoMessage(`templateDir: ${templateDir}`);
  }

  if (!existsSync(templateDir)) {
    errorMessage(
      [
        'Template directory not found.',
        `templateDir: ${templateDir}`,
        `importMetaDir: ${fromDir}`,
        `packageRoot: ${packageRoot}`,
        'If running a linked build, re-run `pnpm build` in @finografic/create.',
      ].join('\n'),
    );
    safeExit(1);
    return;
  }
  for (const item of migrateConfig.syncFromTemplate) {
    if (!shouldRunSection(only, item.section)) continue;
    plan.push(`sync ${item.targetPath} (from template ${item.templatePath})`);
  }

  // Dry-run default
  if (!write) {
    infoMessage(`\nDry run. Planned changes for: ${pc.cyan(targetDir)}\n`);
    for (const line of plan) {
      clack.log.info(`- ${line}`);
    }
    infoMessage('\nRe-run with `--write` to apply.\n');
    return;
  }

  // Apply package.json patch
  if (shouldRunSection(only, 'package-json')) {
    const { packageJson: nextPackageJson, changes } = patchPackageJson(packageJson, parsed.name);
    if (changes.length > 0) {
      await writePackageJson(packageJsonPath, nextPackageJson);
      successMessage(`Updated package.json (${changes.length} changes)`);
    } else {
      infoMessage('package.json already aligned');
    }
  }

  // Apply template sync
  const syncTasks = migrateConfig.syncFromTemplate.filter((item) => shouldRunSection(only, item.section));

  if (syncTasks.length > 0) {
    const syncSpin = clack.spinner();
    syncSpin.start(`Syncing ${syncTasks.length} file(s) from template...`);

    for (const item of syncTasks) {
      const sourcePath = resolve(templateDir, item.templatePath);
      const destinationPath = resolve(targetDir, item.targetPath);

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

  successMessage('Migration complete');
}
