import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as clack from '@clack/prompts';
import { ensureDprintConfig } from 'features/dprint/dprint.template';
import { migrateHelp } from 'help/migrate.help';
import { parseMigrateArgs } from 'migrate/migrate-metadata.utils';
import pc from 'picocolors';
import {
  confirmMerges,
  confirmMigrateTarget,
  confirmNodeVersionUpgrade,
} from 'prompts/migrate.prompt';
import { applyDependencyChanges, planDependencyChanges } from 'src/migrate/dependencies.utils';
import { applyMerges, planMerges } from 'src/migrate/merge.utils';
import { getScopeAndName, shouldRunSection } from 'src/migrate/migrate-metadata.utils';
import {
  applyNodeRuntimeChanges,
  applyNodeTypesChange,
  detectCurrentNodeState,
  detectNodeMajor,
  planNodeRuntimeChanges,
  planNodeTypesChange,
} from 'src/migrate/node.utils';
import {
  patchPackageJson,
  readPackageJson,
  writePackageJson,
} from 'src/migrate/package-json.utils';
import { applyRenames, getExistingFiles, planRenames } from 'src/migrate/rename.utils';

import {
  copyDir,
  copyTemplate,
  ensureDir,
  errorMessage,
  fileExists,
  findPackageRoot,
  getTemplatesPackageDir,
  infoMessage,
  intro,
  renderHelp,
  successMessage,
} from 'utils';
import { isDevelopment, safeExit } from 'utils/env.utils';
import { validateExistingPackage } from 'utils/validation.utils';
import { dependencyRules } from 'config/dependencies.rules';
import { mergeConfig } from 'config/merge.rules';
import { migrateConfig } from 'config/migrate.config';
import { nodePolicy } from 'config/node.policy';
import { renameRules } from 'config/rename.rules';
import type { TemplateVars } from 'types/template.types';

export async function migratePackage(argv: string[], context: { cwd: string; }): Promise<void> {
  if (argv.includes('--help') || argv.includes('-h')) {
    renderHelp(migrateHelp);
    return;
  }

  intro('Migrate existing @finografic package');

  // Helpful debug info (always on in dev)
  const debug = isDevelopment() || process.env.FINOGRAFIC_DEBUG === '1';
  if (debug) {
    infoMessage(`execPath: ${process.execPath}`);
    infoMessage(`argv[1]: ${process.argv[1] ?? ''}`);
  }

  const { targetDir, write, only } = parseMigrateArgs(argv, context.cwd);

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
      plan.push(`${pc.yellow('patch')} package.json: ${changes.join(', ')}`);
    } else {
      plan.push('package.json already aligned');
    }
  }

  // Get template directory early (needed for merge planning)
  const fromDir = fileURLToPath(new URL('.', import.meta.url));
  const packageRoot = findPackageRoot(fromDir);
  const templateDir = getTemplatesPackageDir(fromDir);

  // Dependencies planning
  if (shouldRunSection(only, 'dependencies')) {
    const depChanges = planDependencyChanges(packageJson, dependencyRules);
    if (depChanges.length > 0) {
      plan.push(
        `${pc.cyan('dependencies')}: ${
          depChanges.map((c) => `${c.name} (${c.operation})`).join(', ')
        }`,
      );
    }
  }

  // Node version planning
  let currentNodeState: Awaited<ReturnType<typeof detectCurrentNodeState>> | null = null;
  let nodeRuntimeChanges: ReturnType<typeof planNodeRuntimeChanges> = [];
  let nodeTypesChange: ReturnType<typeof planNodeTypesChange> = null;
  if (shouldRunSection(only, 'node')) {
    currentNodeState = await detectCurrentNodeState(targetDir);
    nodeRuntimeChanges = planNodeRuntimeChanges(currentNodeState, nodePolicy);
    nodeTypesChange = planNodeTypesChange(
      (packageJson.devDependencies as Record<string, string> | undefined)?.['@types/node'],
      nodePolicy,
    );
    if (nodeRuntimeChanges.length > 0 || nodeTypesChange) {
      plan.push(`${pc.green('node')} version updates`);
    }
  }

  // Renames planning
  let existingFiles: Set<string> | null = null;
  let renameChanges: ReturnType<typeof planRenames> = [];
  if (shouldRunSection(only, 'renames')) {
    existingFiles = await getExistingFiles(targetDir, renameRules);
    renameChanges = planRenames(existingFiles, renameRules);
    if (renameChanges.length > 0) {
      plan.push(
        `${pc.yellow('renames')}: ${renameChanges.map((r) => `${r.from} → ${r.to}`).join(', ')}`,
      );
    }
  }

  // Merges planning
  // Note: Merge planning needs to be aware of pending renames
  // If a file will be renamed to the canonical name, treat it as existing
  let mergeChanges: ReturnType<typeof planMerges> = [];
  if (shouldRunSection(only, 'merges')) {
    if (existingFiles === null) {
      existingFiles = await getExistingFiles(targetDir, renameRules);
    }
    // Create a set that includes files that will exist after renames
    const filesAfterRenames = new Set(existingFiles);
    for (const rename of renameChanges) {
      filesAfterRenames.delete(rename.from);
      filesAfterRenames.add(rename.to);
    }
    mergeChanges = planMerges(filesAfterRenames, mergeConfig, templateDir);
    if (mergeChanges.length > 0) {
      plan.push(`${pc.yellow('merges')}: ${mergeChanges.map((m) => m.file).join(', ')}`);
    }
  }

  // template sync plan
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
    plan.push(`${pc.cyan('sync')} ${item.targetPath} (from template ${item.templatePath})`);
  }

  // Check for LICENSE file
  const licensePath = resolve(targetDir, 'LICENSE');
  const licenseExists = fileExists(licensePath);
  const packageLicense = (packageJson.license as string | undefined) || 'MIT';
  const shouldCopyLicense = !licenseExists && packageLicense === 'MIT';
  if (shouldCopyLicense) {
    plan.push(`${pc.cyan('sync')} LICENSE (from template LICENSE)`);
  }

  // dprint planning
  if (shouldRunSection(only, 'dprint')) {
    const dprintPath = resolve(targetDir, 'dprint.jsonc');
    const dprintExists = fileExists(dprintPath);
    if (!dprintExists) {
      plan.push(`${pc.cyan('dprint')}: create dprint.jsonc`);
    } else {
      plan.push('dprint.jsonc already exists');
    }
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

  // Prompts before applying changes
  // 1. Node version prompt (if major version changes)
  if (shouldRunSection(only, 'node') && currentNodeState) {
    const currentMajor = detectNodeMajor(currentNodeState.nvmrc || '');
    if (currentMajor !== null && currentMajor !== nodePolicy.major) {
      const confirmed = await confirmNodeVersionUpgrade({
        from: currentMajor,
        to: nodePolicy.major,
        nvmrc: nodePolicy.local.nvmrc,
      });
      if (!confirmed) {
        safeExit(0);
        return;
      }
    }
  }

  // 2. Merge prompt (if merges exist)
  if (shouldRunSection(only, 'merges') && mergeChanges.length > 0) {
    const confirmed = await confirmMerges(mergeChanges);
    if (!confirmed) {
      safeExit(0);
      return;
    }
  }

  // Apply renames FIRST (before other operations)
  if (shouldRunSection(only, 'renames') && renameChanges.length > 0) {
    await applyRenames(targetDir, renameChanges);
    successMessage(`Renamed ${renameChanges.length} file(s)`);
  }

  // Apply package.json patch
  let updatedPackageJson = packageJson;
  if (shouldRunSection(only, 'package-json')) {
    const { packageJson: nextPackageJson, changes } = patchPackageJson(packageJson, parsed.name);
    if (changes.length > 0) {
      updatedPackageJson = nextPackageJson;
      await writePackageJson(packageJsonPath, updatedPackageJson);
      successMessage(`Updated package.json (${changes.length} changes)`);
    } else {
      infoMessage('package.json already aligned');
    }
  }

  // Apply node version changes
  if (shouldRunSection(only, 'node')) {
    if (nodeRuntimeChanges.length > 0) {
      await applyNodeRuntimeChanges(targetDir, nodeRuntimeChanges);
      successMessage('Updated Node version files');
    }
    if (nodeTypesChange) {
      updatedPackageJson = applyNodeTypesChange(updatedPackageJson, nodeTypesChange);
      await writePackageJson(packageJsonPath, updatedPackageJson);
      successMessage('Updated @types/node');
    }
  }

  // Apply dependency changes
  if (shouldRunSection(only, 'dependencies')) {
    const depChanges = planDependencyChanges(updatedPackageJson, dependencyRules);
    if (depChanges.length > 0) {
      updatedPackageJson = applyDependencyChanges(updatedPackageJson, depChanges);
      await writePackageJson(packageJsonPath, updatedPackageJson);
      successMessage(`Updated ${depChanges.length} dependencies`);
    }
  }

  // Apply merges
  if (shouldRunSection(only, 'merges') && mergeChanges.length > 0) {
    await applyMerges(targetDir, mergeChanges, templateDir, vars);
    successMessage(`Merged ${mergeChanges.length} file(s)`);
  }

  // Apply template sync
  const syncTasks = migrateConfig.syncFromTemplate.filter((item) =>
    shouldRunSection(only, item.section),
  );

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

  // Copy LICENSE if missing
  if (shouldCopyLicense) {
    const licenseSourcePath = resolve(templateDir, 'LICENSE');
    const licenseDestPath = resolve(targetDir, 'LICENSE');
    await copyTemplate(licenseSourcePath, licenseDestPath, vars);
    successMessage('Added LICENSE file');
  }

  // Apply dprint config
  if (shouldRunSection(only, 'dprint')) {
    const result = await ensureDprintConfig(targetDir);
    if (result.wrote) {
      successMessage('Created dprint.jsonc');
    } else {
      infoMessage('dprint.jsonc already exists');
    }
  }

  successMessage('Migration complete');
}
