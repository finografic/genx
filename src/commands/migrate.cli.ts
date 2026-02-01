import { resolve } from 'node:path';

import * as clack from '@clack/prompts';
import { execa } from 'execa';
import type { FeatureId } from 'features/feature.types';
import { getFeature } from 'features/feature-registry';
import { migrateHelp } from 'help/migrate.help';
import * as pc from 'picocolors';
import { applyDependencyChanges, planDependencyChanges } from 'src/lib/migrate/dependencies.utils';
import { restructureDocs } from 'src/lib/migrate/docs-restructure.utils';
import { applyMerges } from 'src/lib/migrate/merge.utils';
import { parseMigrateArgs } from 'src/lib/migrate/migrate-metadata.utils';
import { getScopeAndName, shouldRunSection } from 'src/lib/migrate/migrate-metadata.utils';
import {
  applyNodeRuntimeChanges,
  applyNodeTypesChange,
  detectNodeMajor,
} from 'src/lib/migrate/node.utils';
import {
  patchPackageJson,
  readPackageJson,
  writePackageJson,
} from 'src/lib/migrate/package-json.utils';
import { planMigration } from 'src/lib/migrate/plan.utils';
import { applyRenames } from 'src/lib/migrate/rename.utils';
import { copyLicenseIfMissing, syncFromTemplate } from 'src/lib/migrate/template-sync.utils';
import { promptFeatures } from 'src/lib/prompts/features.prompt';
import {
  confirmMerges,
  confirmMigrateTarget,
  confirmNodeVersionUpgrade,
} from 'src/lib/prompts/migrate.prompt';

import { errorMessage, infoMessage, intro, renderHelp, spinner, successMessage } from 'utils';
import { isDevelopment, safeExit } from 'utils/env.utils';
import { validateExistingPackage } from 'utils/validation.utils';
import { dependencyRules } from 'config/dependencies.rules';
import { migrateConfig } from 'config/migrate.config';
import { nodePolicy } from 'config/node.policy';
import type { TemplateVars } from 'types/template.types';

export async function migratePackage(argv: string[], context: { cwd: string }): Promise<void> {
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

  // Prompt for features (after confirmation, before planning)
  const selectedFeatureIds = await promptFeatures();
  if (!selectedFeatureIds) {
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

  // Plan all migration changes
  const { plan, state } = await planMigration(
    targetDir,
    packageJson,
    parsed,
    selectedFeatureIds,
    only,
    debug,
  );

  const {
    currentNodeState,
    nodeRuntimeChanges,
    nodeTypesChange,
    renameChanges,
    mergeChanges,
    shouldCopyLicense,
    templateDir,
  } = state;

  // Dry-run default
  if (!write) {
    infoMessage(`\nDRY RUN. Planned changes for:\n${pc.cyan(targetDir)}\n`);
    for (const line of plan) {
      clack.log.info(`- ${line}`);
    }
    infoMessage(
      `${pc.greenBright('DRY RUN COMPLETE.')}\n\n${pc.white('Re-run with')} ${
        pc.greenBright('--write')
      } ${pc.white('to apply changes.')}\n`,
    );
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
  let hasDependencyChanges = false;
  if (shouldRunSection(only, 'dependencies')) {
    const depChanges = planDependencyChanges(updatedPackageJson, dependencyRules);
    if (depChanges.length > 0) {
      updatedPackageJson = applyDependencyChanges(updatedPackageJson, depChanges);
      await writePackageJson(packageJsonPath, updatedPackageJson);
      successMessage(`Updated ${depChanges.length} dependencies`);
      hasDependencyChanges = true;
    }
  }

  // Apply merges
  if (shouldRunSection(only, 'merges') && mergeChanges.length > 0) {
    await applyMerges(targetDir, mergeChanges, templateDir, vars);
    successMessage(`Merged ${mergeChanges.length} file(s)`);
  }

  // Restructure docs/ folder (if docs section is enabled)
  // This runs BEFORE template sync to avoid overwriting existing restructured files
  await restructureDocs(targetDir, only);

  // Apply template sync
  await syncFromTemplate(targetDir, templateDir, vars, only);

  // Copy LICENSE if missing
  await copyLicenseIfMissing(targetDir, templateDir, vars, shouldCopyLicense);
  if (shouldCopyLicense) {
    successMessage('Added LICENSE file');
  }

  // Apply features
  const appliedFeatures: FeatureId[] = [];
  const noopMessages: string[] = [];

  for (const featureId of selectedFeatureIds) {
    const feature = getFeature(featureId);
    if (!feature) {
      errorMessage(`Unknown feature: ${featureId}`);
      continue;
    }

    if (feature.detect) {
      const detected = await feature.detect({ targetDir });
      if (detected) {
        noopMessages.push(
          `${feature.label} already installed. No changes made.`,
        );
        continue;
      }
    }

    const result = await feature.apply({ targetDir });
    if (result.error) {
      errorMessage(result.error.message);
      safeExit(1);
      return;
    }

    if (result.applied.length > 0) {
      appliedFeatures.push(featureId);
    } else {
      noopMessages.push(
        result.noopMessage ?? `${feature.label} already installed. No changes made.`,
      );
    }
  }

  // Show feature results
  if (appliedFeatures.length > 0) {
    successMessage(`Applied ${appliedFeatures.length} feature(s): ${appliedFeatures.join(', ')}`);
    for (const msg of noopMessages) {
      infoMessage(msg);
    }
  } else if (noopMessages.length > 0) {
    for (const msg of noopMessages) {
      infoMessage(msg);
    }
  }

  // Install dependencies if any were updated
  if (hasDependencyChanges) {
    const installSpin = spinner();
    installSpin.start('Installing dependencies...');

    try {
      await execa('pnpm', ['install'], { cwd: targetDir });
      installSpin.stop('Dependencies installed');
    } catch {
      installSpin.stop('Failed to install dependencies');
      errorMessage('You can run `pnpm install` manually');
    }
  }

  successMessage('Migration complete');
}
