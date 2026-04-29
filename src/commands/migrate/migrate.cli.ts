import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { confirmFileWrite, createDiffConfirmState } from '@finografic/cli-kit/file-diff';
import { createFlowContext } from '@finografic/cli-kit/flow';
import { withHelp } from '@finografic/cli-kit/render-help';
import * as clack from '@clack/prompts';
import { execa } from 'execa';
import { getFeature } from 'features/feature-registry';
import {
  GENX_CONFIG_PATH,
  errorMessage,
  hasManagedFlag,
  infoMessage,
  intro,
  readManagedTargets,
  spinner,
  successMessage,
  successUpdatedMessage,
} from 'utils';
import type { FeatureId } from 'features/feature.types';

import { isAgentDocsAlreadyMigrated, migrateAgentDocs } from './lib/agent-docs-migration.js';
import { restructureDocs } from './lib/docs-restructure.utils.js';
import { applyMerges } from './lib/merge.utils.js';
import { confirmMerges, confirmMigrateTarget, confirmNodeVersionUpgrade } from './lib/migrate.prompt.js';
import { applyNodeRuntimeChanges, applyNodeTypesChange, detectNodeMajor } from './lib/node.utils.js';
import { planMigration } from './lib/plan.utils.js';
import { applyRenames } from './lib/rename.utils.js';
import { copyLicenseIfMissing, syncFromTemplate } from './lib/template-sync.utils.js';
import { generateCliHelpContent, getBinName, isCliPackage } from 'lib/generators/cli-help.generator';
import { applyDependencyChanges, planDependencyChanges } from 'lib/migrate/dependencies.utils';
import { getScopeAndName, parseMigrateArgs, shouldRunSection } from 'lib/migrate/migrate-metadata.utils';
import {
  patchPackageJson,
  readPackageJson,
  stripCommitlintFromPackageJsonFile,
  writePackageJson,
} from 'lib/migrate/package-json.utils';
import { promptFeatures } from 'lib/prompts/features.prompt';
import { promptManagedTargetAction } from 'lib/prompts/managed.prompt';
import { isDevelopment } from 'utils/env.utils';
import { pc } from 'utils/picocolors';
import { validateExistingPackage } from 'utils/validation.utils';

import { dependencyRules } from 'config/dependencies.rules';
import { migrateConfig } from 'config/migrate.config';
import { nodePolicy } from 'config/node.policy';
import { policy } from 'config/policy.js';
import type { ManagedTarget } from 'types/managed.types';
import type { MigrateOnlySection } from 'types/migrate.types';
import { MIGRATE_ONLY_SECTIONS } from 'types/migrate.types';
import type { TemplateVars } from 'types/template.types';

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
      let managedTargets: ManagedTarget[];
      try {
        managedTargets = await readManagedTargets();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to read managed config';
        errorMessage(`${message}\nExpected config: ${pc.cyan(GENX_CONFIG_PATH)}`);
        process.exit(1);
        return;
      }

      if (managedTargets.length === 0) {
        infoMessage(`No managed targets found in ${pc.cyan(GENX_CONFIG_PATH)}`);
        return;
      }

      let selectedFeatureIds: FeatureId[] = [];
      if (!only) {
        const prompted = await promptFeatures(flow);
        if (!prompted) {
          process.exit(0);
          return;
        }
        selectedFeatureIds = prompted;
      }

      let appliedCount = 0;
      let skippedCount = 0;

      for (const [index, target] of managedTargets.entries()) {
        if (write && !flow.yesMode) {
          const action = await promptManagedTargetAction({
            actionLabel: 'Migrate',
            target,
            currentIndex: index + 1,
            total: managedTargets.length,
          });

          if (action === null) {
            process.exit(0);
            return;
          }

          if (action === 'skip') {
            skippedCount += 1;
            continue;
          }
        }

        await migrateSingleTarget({
          targetDir: target.path,
          write,
          only,
          debug,
          selectedFeatureIds,
        });
        appliedCount += 1;
      }

      successMessage(
        `Managed run complete (${appliedCount} processed${skippedCount > 0 ? `, ${skippedCount} skipped` : ''})`,
      );
      return;
    }

    let selectedFeatureIds: FeatureId[] = [];
    if (!only) {
      const mode = await clack.select({
        message: 'What would you like to do?',
        options: [
          { value: 'features', label: 'Select optional features' },
          {
            value: 'agent-docs',
            label: 'Migrate AI agent docs',
            hint: 'restructure .github/instructions/, AGENTS.md, CLAUDE.md',
          },
        ],
      });

      if (clack.isCancel(mode)) {
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

async function runAgentDocsMigration(targetDir: string, write: boolean): Promise<void> {
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

async function migrateSingleTarget(params: {
  targetDir: string;
  write: boolean;
  only: Set<MigrateOnlySection> | null;
  debug: boolean;
  selectedFeatureIds: FeatureId[];
}): Promise<void> {
  const { targetDir, write, only, debug, selectedFeatureIds } = params;
  const diffState = createDiffConfirmState();

  const validation = validateExistingPackage(targetDir);
  if (!validation.ok) {
    errorMessage(validation.reason || 'Not a valid package directory');
    process.exit(1);
    return;
  }

  const packageJsonPath = resolve(targetDir, 'package.json');
  const packageJson = await readPackageJson(packageJsonPath);
  const parsed = getScopeAndName(packageJson.name);
  if (!parsed) {
    errorMessage('Unable to read package name from package.json');
    process.exit(1);
    return;
  }

  const ok = await confirmMigrateTarget({
    scope: parsed.scope,
    name: parsed.name,
    expectedScope: migrateConfig.defaultScope,
  });
  if (!ok) {
    process.exit(0);
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
    infoMessage(`${pc.green('DRY RUN.')} ${pc.white('Planned changes for:')}\n${pc.cyan(targetDir)}`);
    for (const line of plan) {
      clack.log.info(`- ${line}`);
    }

    // CLI-type: check if help file needs to be created (skipped when --only is set)
    if (!only && isCliPackage(packageJson)) {
      const binName = getBinName(packageJson, parsed.name);
      const helpFilePath = resolve(targetDir, `src/${binName}.help.ts`);
      if (!existsSync(helpFilePath)) {
        clack.log.info(`- Would create src/${binName}.help.ts (CLI project)`);
      }
    }

    infoMessage(`${pc.white('Re-run with')} ${pc.yellow('--write')} ${pc.white('to apply changes.')}\n\n`);
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
        process.exit(0);
        return;
      }
    }
  }

  // 2. Merge prompt (if merges exist)
  if (shouldRunSection(only, 'merges') && mergeChanges.length > 0) {
    const confirmed = await confirmMerges(mergeChanges);
    if (!confirmed) {
      process.exit(0);
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
      const currentContent = await readFile(packageJsonPath, 'utf8');
      const proposedContent = `${JSON.stringify(updatedPackageJson, null, 2)}\n`;
      const action = await confirmFileWrite(packageJsonPath, currentContent, proposedContent, diffState);
      if (action !== 'skip') {
        await writePackageJson(packageJsonPath, updatedPackageJson);
        successUpdatedMessage(`Updated package.json (${changes.length} changes)`);
      }
    } else {
      infoMessage('package.json already aligned');
    }
  }

  // Apply node version changes
  if (shouldRunSection(only, 'node')) {
    if (nodeRuntimeChanges.length > 0) {
      await applyNodeRuntimeChanges(targetDir, nodeRuntimeChanges);
      successUpdatedMessage('Updated Node version files');
    }
    if (nodeTypesChange) {
      updatedPackageJson = applyNodeTypesChange(updatedPackageJson, nodeTypesChange);
      const currentContent = await readFile(packageJsonPath, 'utf8');
      const proposedContent = `${JSON.stringify(updatedPackageJson, null, 2)}\n`;
      const action = await confirmFileWrite(packageJsonPath, currentContent, proposedContent, diffState);
      if (action !== 'skip') {
        await writePackageJson(packageJsonPath, updatedPackageJson);
        successUpdatedMessage('Updated @types/node');
      }
    }
  }

  // Apply dependency changes
  let hasDependencyChanges = false;
  if (shouldRunSection(only, 'dependencies')) {
    const depChanges = planDependencyChanges(updatedPackageJson, dependencyRules);
    if (depChanges.length > 0) {
      updatedPackageJson = applyDependencyChanges(updatedPackageJson, depChanges);
      const currentContent = await readFile(packageJsonPath, 'utf8');
      const proposedContent = `${JSON.stringify(updatedPackageJson, null, 2)}\n`;
      const action = await confirmFileWrite(packageJsonPath, currentContent, proposedContent, diffState);
      if (action !== 'skip') {
        await writePackageJson(packageJsonPath, updatedPackageJson);
        successMessage(`Updated ${depChanges.length} dependencies`);
        hasDependencyChanges = true;
      }
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
  await syncFromTemplate(targetDir, templateDir, vars, only, updatedPackageJson);

  if (shouldRunSection(only, 'hooks')) {
    const removedInlinedCommitlint = await stripCommitlintFromPackageJsonFile(packageJsonPath);
    if (removedInlinedCommitlint) {
      successUpdatedMessage('Removed inlined commitlint from package.json (use commitlint.config.mjs)');
      updatedPackageJson = await readPackageJson(packageJsonPath);
    }
  }

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
        noopMessages.push(`${feature.label} already installed. No changes made.`);
        continue;
      }
    }

    const result = await feature.apply({ targetDir });
    if (result.error) {
      errorMessage(result.error.message);
      process.exit(1);
      return;
    }

    if (result.applied.length > 0) {
      appliedFeatures.push(featureId);
    } else {
      noopMessages.push(result.noopMessage ?? `${feature.label} already installed. No changes made.`);
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

  // For CLI-type packages: ensure *.help.ts exists (skipped when --only is set)
  if (!only && isCliPackage(updatedPackageJson)) {
    const binName = getBinName(updatedPackageJson, parsed.name);
    const helpFilePath = resolve(targetDir, `src/${binName}.help.ts`);

    if (!existsSync(helpFilePath)) {
      await writeFile(helpFilePath, generateCliHelpContent(binName), 'utf8');
      successMessage(`Created src/${binName}.help.ts`);

      // Ensure picocolors is in dependencies (required by the help file)
      const deps = updatedPackageJson['dependencies'] ?? {};
      if (!deps['picocolors']) {
        deps['picocolors'] = policy.cli.dependencies?.['picocolors'] ?? '^1.1.1';
        updatedPackageJson['dependencies'] = deps;
        await writePackageJson(packageJsonPath, updatedPackageJson);
        hasDependencyChanges = true;
      }
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
