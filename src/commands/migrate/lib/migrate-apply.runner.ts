import { readFile } from 'node:fs/promises';
import { confirmFileWrite } from '@finografic/cli-kit/file-diff';
import { infoMessage, successMessage, successUpdatedMessage } from 'utils';
import type { MigrateTargetContext } from './migrate-target-context.js';
import type { FeatureId } from 'features/feature.types';

import { applyDependencyChanges, planDependencyChanges } from 'lib/migrate/dependencies.utils';
import {
  patchPackageJson,
  readPackageJson,
  stripCommitlintFromPackageJsonFile,
  writePackageJson,
} from 'lib/migrate/package-json.utils';

import { dependencyRules } from 'config/dependencies.rules';
import { nodePolicy } from 'config/node.policy';
import type { MigrateOnlySection } from 'types/migrate.types';

import { applyMerges } from './merge.utils.js';
import { shouldRunSection } from './migrate-metadata.utils.js';
import {
  applySelectedFeatures,
  ensureCliHelpFile,
  installDependenciesIfNeeded,
  logFeatureResults,
} from './migrate-tail.runner.js';
import { confirmMerges, confirmNodeVersionUpgrade } from './migrate.prompt.js';
import { applyNodeRuntimeChanges, applyNodeTypesChange, detectNodeMajor } from './node.utils.js';
import { applyRenames } from './rename.utils.js';
import { copyLicenseIfMissing, syncFromTemplate } from './template-sync.utils.js';

export async function applyMigrateTarget(params: {
  context: MigrateTargetContext;
  only: Set<MigrateOnlySection> | null;
  selectedFeatureIds: FeatureId[];
}): Promise<void> {
  const { context, only, selectedFeatureIds } = params;
  const {
    currentNodeState,
    nodeRuntimeChanges,
    nodeTypesChange,
    renameChanges,
    mergeChanges,
    shouldCopyLicense,
    templateDir,
  } = context.state;

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

  if (shouldRunSection(only, 'merges') && mergeChanges.length > 0) {
    const confirmed = await confirmMerges(mergeChanges);
    if (!confirmed) {
      process.exit(0);
      return;
    }
  }

  if (shouldRunSection(only, 'renames') && renameChanges.length > 0) {
    await applyRenames(context.targetDir, renameChanges);
    successMessage(`Renamed ${renameChanges.length} file(s)`);
  }

  let updatedPackageJson = context.packageJson;
  if (shouldRunSection(only, 'package-json')) {
    const { packageJson: nextPackageJson, changes } = patchPackageJson(
      context.packageJson,
      context.parsed.name,
    );
    if (changes.length > 0) {
      updatedPackageJson = nextPackageJson;
      const currentContent = await readFile(context.packageJsonPath, 'utf8');
      const proposedContent = `${JSON.stringify(updatedPackageJson, null, 2)}\n`;
      const action = await confirmFileWrite(
        context.packageJsonPath,
        currentContent,
        proposedContent,
        context.diffState,
      );
      if (action !== 'skip') {
        await writePackageJson(context.packageJsonPath, updatedPackageJson);
        successUpdatedMessage(`Updated package.json (${changes.length} changes)`);
      }
    } else {
      infoMessage('package.json already aligned');
    }
  }

  if (shouldRunSection(only, 'node')) {
    if (nodeRuntimeChanges.length > 0) {
      await applyNodeRuntimeChanges(context.targetDir, nodeRuntimeChanges);
      successUpdatedMessage('Updated Node version files');
    }
    if (nodeTypesChange) {
      updatedPackageJson = applyNodeTypesChange(updatedPackageJson, nodeTypesChange);
      const currentContent = await readFile(context.packageJsonPath, 'utf8');
      const proposedContent = `${JSON.stringify(updatedPackageJson, null, 2)}\n`;
      const action = await confirmFileWrite(
        context.packageJsonPath,
        currentContent,
        proposedContent,
        context.diffState,
      );
      if (action !== 'skip') {
        await writePackageJson(context.packageJsonPath, updatedPackageJson);
        successUpdatedMessage('Updated @types/node');
      }
    }
  }

  let hasDependencyChanges = false;
  if (shouldRunSection(only, 'dependencies')) {
    const depChanges = planDependencyChanges(updatedPackageJson, dependencyRules);
    if (depChanges.length > 0) {
      updatedPackageJson = applyDependencyChanges(updatedPackageJson, depChanges);
      const currentContent = await readFile(context.packageJsonPath, 'utf8');
      const proposedContent = `${JSON.stringify(updatedPackageJson, null, 2)}\n`;
      const action = await confirmFileWrite(
        context.packageJsonPath,
        currentContent,
        proposedContent,
        context.diffState,
      );
      if (action !== 'skip') {
        await writePackageJson(context.packageJsonPath, updatedPackageJson);
        successMessage(`Updated ${depChanges.length} dependencies`);
        hasDependencyChanges = true;
      }
    }
  }

  context.packageJson = updatedPackageJson;

  if (shouldRunSection(only, 'merges') && mergeChanges.length > 0) {
    await applyMerges(context.targetDir, mergeChanges, templateDir, context.vars);
    successMessage(`Merged ${mergeChanges.length} file(s)`);
  }

  await syncFromTemplate(context.targetDir, templateDir, context.vars, only, updatedPackageJson);

  if (shouldRunSection(only, 'hooks')) {
    const removedInlinedCommitlint = await stripCommitlintFromPackageJsonFile(context.packageJsonPath);
    if (removedInlinedCommitlint) {
      successUpdatedMessage('Removed inlined commitlint from package.json (use commitlint.config.mjs)');
      updatedPackageJson = await readPackageJson(context.packageJsonPath);
      context.packageJson = updatedPackageJson;
    }
  }

  await copyLicenseIfMissing(context.targetDir, templateDir, context.vars, shouldCopyLicense);
  if (shouldCopyLicense) {
    successMessage('Added LICENSE file');
  }

  const featureResults = await applySelectedFeatures(context.targetDir, selectedFeatureIds);
  logFeatureResults(featureResults);

  hasDependencyChanges = await ensureCliHelpFile({ context, only, hasDependencyChanges });
  await installDependenciesIfNeeded(context.targetDir, hasDependencyChanges);
  successMessage('Migration complete');
}
