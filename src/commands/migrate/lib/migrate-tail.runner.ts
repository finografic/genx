import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execa } from 'execa';
import { getFeature } from 'features/feature-registry';
import { errorMessage, infoMessage, spinner, successMessage } from 'utils';
import type { MigrateTargetContext } from './migrate-target-context.js';
import type { FeatureId } from 'features/feature.types';

import { generateCliHelpContent, getBinName, isCliPackage } from 'lib/generators/cli-help.generator';
import { writePackageJson } from 'lib/migrate/package-json.utils';

import { policy } from 'config/policy.js';
import type { MigrateOnlySection } from 'types/migrate.types';

export async function applySelectedFeatures(
  targetDir: string,
  selectedFeatureIds: FeatureId[],
): Promise<{ appliedFeatures: FeatureId[]; noopMessages: string[] }> {
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
      return { appliedFeatures, noopMessages };
    }

    if (result.applied.length > 0) {
      appliedFeatures.push(featureId);
    } else {
      noopMessages.push(result.noopMessage ?? `${feature.label} already installed. No changes made.`);
    }
  }

  return { appliedFeatures, noopMessages };
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
  context: MigrateTargetContext;
  only: Set<MigrateOnlySection> | null;
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
    await execa('pnpm', ['install'], { cwd: targetDir });
    installSpin.stop('Dependencies installed');
  } catch {
    installSpin.stop('Failed to install dependencies');
    errorMessage('You can run `pnpm install` manually');
  }
}
