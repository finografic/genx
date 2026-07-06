import { join } from 'node:path';
import { createFlowContext } from '@finografic/cli-kit/flow';
import {
  GENX_CONFIG_PATH,
  errorMessage,
  infoMessage,
  intro,
  logMessage,
  readManagedTargets,
  successMessage,
} from 'utils';
import type { FeatureAuditEntry } from '../audit/lib/audit.js';
import type { FeatureId } from 'features/feature.types';

import { applyFeaturesToTarget, logFeatureResults } from 'lib/features/apply-features.runner';
import { promptManagedTargetAction } from 'lib/managed/managed.prompt';
import { readPackageJson } from 'lib/migrate/package-json.utils';
import { pc } from 'utils/picocolors';
import { validateExistingPackage } from 'utils/validation.utils';

import type { ManagedTarget } from 'types/managed.types';

import { auditFeatures, filterAuditEntriesForSelfPackage, sortAuditEntries } from '../audit/lib/audit.js';

interface ManagedAuditTargetResult {
  actionable: FeatureAuditEntry[];
  missingCount: number;
  partialCount: number;
  target: ManagedTarget;
}

function getActionableEntries(entries: FeatureAuditEntry[]): FeatureAuditEntry[] {
  return sortAuditEntries(entries).filter((entry) => entry.status !== 'installed');
}

function formatCount(result: ManagedAuditTargetResult): string {
  const parts: string[] = [];
  if (result.partialCount > 0) parts.push(pc.yellow(`${result.partialCount} partial`));
  if (result.missingCount > 0) parts.push(pc.red(`${result.missingCount} missing`));
  return parts.join(pc.dim(' · '));
}

function formatFeatureList(entries: FeatureAuditEntry[]): string {
  return entries.map((entry) => `${entry.feature.label} ${pc.gray(`(${entry.status})`)}`).join(pc.dim(', '));
}

async function auditManagedTarget(target: ManagedTarget): Promise<ManagedAuditTargetResult | null> {
  const validation = validateExistingPackage(target.path);
  if (!validation.ok) {
    errorMessage(`${target.name}: ${validation.reason || 'Not a valid package directory'}`);
    return null;
  }

  const packageJson = await readPackageJson(join(target.path, 'package.json'));
  const targetPackageName = typeof packageJson.name === 'string' ? packageJson.name : undefined;
  const entries = filterAuditEntriesForSelfPackage(
    await auditFeatures({ targetDir: target.path }),
    targetPackageName,
  );
  const actionable = getActionableEntries(entries);

  return {
    actionable,
    missingCount: actionable.filter((entry) => entry.status === 'missing').length,
    partialCount: actionable.filter((entry) => entry.status === 'partial').length,
    target,
  };
}

function printManagedAuditSummary(results: ManagedAuditTargetResult[]): void {
  const actionableResults = results.filter((result) => result.actionable.length > 0);
  const cleanCount = results.length - actionableResults.length;

  infoMessage(
    `Managed audit: ${actionableResults.length} target(s) need repair${cleanCount > 0 ? `, ${cleanCount} up to date` : ''}`,
  );

  for (const result of results) {
    if (result.actionable.length === 0) {
      logMessage(`${pc.green('ok')} ${pc.cyan(result.target.name)} ${pc.dim('features up to date')}`);
      continue;
    }

    logMessage(`${pc.cyan(result.target.name)} ${pc.dim(`(${formatCount(result)})`)}`);
    logMessage(pc.dim(`  ${formatFeatureList(result.actionable)}`));
  }
}

async function readAuditTargets(): Promise<ManagedTarget[]> {
  try {
    return await readManagedTargets();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to read managed config';
    errorMessage(`${message}\nExpected config: ${pc.cyan(GENX_CONFIG_PATH)}`);
    process.exit(1);
  }
}

export async function runManagedAuditFlow(argv: string[]): Promise<void> {
  intro('Managed audit across @finografic packages');

  const flow = createFlowContext(argv, { y: { type: 'boolean' } });
  const managedTargets = await readAuditTargets();

  if (managedTargets.length === 0) {
    infoMessage(`No managed targets found in ${pc.cyan(GENX_CONFIG_PATH)}`);
    return;
  }

  const auditResults: ManagedAuditTargetResult[] = [];
  for (const target of managedTargets) {
    const result = await auditManagedTarget(target);
    if (result) auditResults.push(result);
  }

  printManagedAuditSummary(auditResults);

  const actionableResults = auditResults.filter((result) => result.actionable.length > 0);
  if (actionableResults.length === 0) {
    successMessage('All managed targets are up to date');
    return;
  }

  let appliedCount = 0;
  let skippedCount = 0;

  for (const [index, result] of actionableResults.entries()) {
    if (!flow.yesMode) {
      const action = await promptManagedTargetAction({
        actionLabel: 'Repair features in',
        target: result.target,
        currentIndex: index + 1,
        total: actionableResults.length,
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

    const selectedFeatureIds: FeatureId[] = result.actionable.map((entry) => entry.feature.id);
    const applyResults = await applyFeaturesToTarget(result.target.path, selectedFeatureIds, {
      commandName: 'managed audit',
      yesAll: flow.yesMode,
    });
    logFeatureResults(applyResults);
    appliedCount += 1;
  }

  successMessage(
    `Managed audit complete (${appliedCount} repaired${skippedCount > 0 ? `, ${skippedCount} skipped` : ''})`,
  );
}
