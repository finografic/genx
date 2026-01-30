import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { FeatureId } from 'features/feature.types';
import { getFeature } from 'features/feature-registry';
import { planDependencyChanges } from 'migrate/dependencies.utils';
import { planMerges } from 'migrate/merge.utils';
import { shouldRunSection } from 'migrate/migrate-metadata.utils';
import {
  detectCurrentNodeState,
  planNodeRuntimeChanges,
  planNodeTypesChange,
} from 'migrate/node.utils';
import { patchPackageJson } from 'migrate/package-json.utils';
import { getExistingFiles, planRenames } from 'migrate/rename.utils';
import * as pc from 'picocolors';

import {
  errorMessage,
  fileExists,
  findPackageRoot,
  getTemplatesPackageDir,
  infoMessage,
} from 'utils';
import { safeExit } from 'utils/env.utils';
import { dependencyRules } from 'config/dependencies.rules';
import { mergeConfig } from 'config/merge.rules';
import { migrateConfig } from 'config/migrate.config';
import { nodePolicy } from 'config/node.policy';
import { renameRules } from 'config/rename.rules';
import type { MigrateOnlySection } from 'types/migrate.types';
import type { PackageJson } from 'types/package-json.types';

export interface MigrationPlanState {
  currentNodeState: Awaited<ReturnType<typeof detectCurrentNodeState>> | null;
  nodeRuntimeChanges: ReturnType<typeof planNodeRuntimeChanges>;
  nodeTypesChange: ReturnType<typeof planNodeTypesChange>;
  existingFiles: Set<string> | null;
  renameChanges: ReturnType<typeof planRenames>;
  mergeChanges: ReturnType<typeof planMerges>;
  shouldCopyLicense: boolean;
  templateDir: string;
}

export interface MigrationPlanResult {
  plan: string[];
  state: MigrationPlanState;
}

/**
 * Plan all migration changes without applying them.
 */
export async function planMigration(
  targetDir: string,
  packageJson: PackageJson,
  parsed: { scope: string; name: string },
  selectedFeatureIds: FeatureId[],
  only: Set<MigrateOnlySection> | null,
  debug: boolean,
): Promise<MigrationPlanResult> {
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
        `${pc.yellow('renames')}: ${
          renameChanges.map((nameChange) => `${nameChange.from} → ${nameChange.to}`).join(', ')
        }`,
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
    throw new Error('Template directory not found');
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

  // Features planning
  const featuresPlan: string[] = [];
  for (const featureId of selectedFeatureIds) {
    const feature = getFeature(featureId);
    if (!feature) continue;

    if (feature.detect) {
      const detected = await feature.detect({ targetDir });
      if (detected) {
        featuresPlan.push(`${feature.label} already installed`);
      } else {
        featuresPlan.push(`${pc.cyan('feature')}: ${feature.label}`);
      }
    } else {
      featuresPlan.push(`${pc.cyan('feature')}: ${feature.label}`);
    }
  }
  if (featuresPlan.length > 0) {
    plan.push(...featuresPlan);
  }

  return {
    plan,
    state: {
      currentNodeState,
      nodeRuntimeChanges,
      nodeTypesChange,
      existingFiles,
      renameChanges,
      mergeChanges,
      shouldCopyLicense,
      templateDir,
    },
  };
}
