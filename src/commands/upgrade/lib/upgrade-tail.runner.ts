import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { errorMessage, infoMessage, runPnpmInstall, spinner, successMessage } from 'utils';
import type { UpgradeTargetContext } from './upgrade-target-context.js';
import type { FeatureId } from 'features/feature.types';

import { applyFeaturesToTarget } from 'lib/features/apply-features.runner';
import { generateCliHelpContent, getBinName, isCliPackage } from 'lib/generators/cli-help.generator';
import { writePackageJson } from 'lib/package-policy/package-json.utils';

import { policy } from 'config/policy.js';
import type { UpgradeOnlySection } from 'types/upgrade.types';

export async function applySelectedFeatures(
  targetDir: string,
  selectedFeatureIds: FeatureId[],
): Promise<{ appliedFeatures: FeatureId[]; noopMessages: string[] }> {
  return applyFeaturesToTarget(targetDir, selectedFeatureIds, { commitEachFeature: false });
}

export function logFeatureResults(results: { appliedFeatures: FeatureId[]; noopMessages: string[] }): void {
  if (results.appliedFeatures.length > 0) {
    successMessage(
      `Applied ${results.appliedFeatures.length} feature(s): ${results.appliedFeatures.join(', ')}`,
    );
    for (const msg of results.noopMessages) {
      infoMessage(msg);
    }
    return;
  }

  for (const msg of results.noopMessages) {
    infoMessage(msg);
  }
}

export async function ensureCliHelpFile(params: {
  context: UpgradeTargetContext;
  only: Set<UpgradeOnlySection> | null;
  hasDependencyChanges: boolean;
}): Promise<boolean> {
  if ((params.only && params.only.size === 0) || !isCliPackage(params.context.packageJson)) {
    return params.hasDependencyChanges;
  }

  const binName = getBinName(params.context.packageJson, params.context.parsed.name);
  const helpFilePath = resolve(params.context.targetDir, `src/${binName}.help.ts`);

  if (!existsSync(helpFilePath)) {
    await writeFile(helpFilePath, generateCliHelpContent(binName), 'utf8');
    successMessage(`Created src/${binName}.help.ts`);

    const deps = params.context.packageJson['dependencies'] ?? {};
    if (!deps['picocolors']) {
      deps['picocolors'] = policy.cli.dependencies?.['picocolors'] ?? '^1.1.1';
      params.context.packageJson['dependencies'] = deps;
      await writePackageJson(params.context.packageJsonPath, params.context.packageJson);
      return true;
    }
  }

  return params.hasDependencyChanges;
}

export async function installDependenciesIfNeeded(
  targetDir: string,
  hasDependencyChanges: boolean,
): Promise<void> {
  if (!hasDependencyChanges) {
    return;
  }

  const installSpin = spinner();
  installSpin.start('Installing dependencies...');

  try {
    await runPnpmInstall(targetDir);
    installSpin.stop('Dependencies installed');
  } catch {
    installSpin.stop('Failed to install dependencies');
    errorMessage('You can run `pnpm install` manually');
  }
}
