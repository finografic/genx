import { join } from 'node:path';
import { createFlowContext } from '@finografic/cli-kit/flow';
import { getFeatureIds } from 'features/feature-registry';
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
import { readPackageJson } from 'lib/package-policy/package-json.utils';
import { pc } from 'utils/picocolors';
import { validateExistingPackage } from 'utils/validation.utils';

import type { ManagedTarget } from 'types/managed.types';

import { auditFeatures, filterAuditEntriesForSelfPackage, sortAuditEntries } from '../audit/lib/audit.js';
import { promptAuditSuggest } from '../audit/lib/audit.prompt.js';

interface ManagedAuditTargetResult {
  actionable: FeatureAuditEntry[];
  entries: FeatureAuditEntry[];
  missingCount: number;
  partialCount: number;
  target: ManagedTarget;
}

function getActionableEntries(entries: FeatureAuditEntry[]): FeatureAuditEntry[] {
  return sortAuditEntries(entries).filter((entry) => entry.status !== 'installed');
}

function getSelectedActionableEntries(
  result: ManagedAuditTargetResult,
  requestedFeatureIds: readonly FeatureId[] | null,
): FeatureAuditEntry[] {
  if (!requestedFeatureIds) return result.actionable;
  const requested = new Set<FeatureId>(requestedFeatureIds);
  return result.actionable.filter((entry) => requested.has(entry.feature.id));
}

function formatCount(entries: readonly FeatureAuditEntry[]): string {
  const parts: string[] = [];
  const partialCount = entries.filter((entry) => entry.status === 'partial').length;
  const missingCount = entries.filter((entry) => entry.status === 'missing').length;
  if (partialCount > 0) parts.push(pc.yellow(`${partialCount} partial`));
  if (missingCount > 0) parts.push(pc.red(`${missingCount} missing`));
  return parts.join(pc.dim(' · '));
}

function featureIdToCliKey(featureId: FeatureId): string {
  return featureId.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}

function parseFeaturesArg(argv: readonly string[]): string | null {
  for (const arg of argv) {
    if (arg === '--features') {
      errorMessage('Use --features=<keys> with a comma-separated feature list');
      process.exit(1);
    }
    if (arg?.startsWith('--features=')) {
      return arg.slice('--features='.length);
    }
  }
  return null;
}

function parseRequestedFeatureIds(argv: readonly string[]): FeatureId[] | null {
  const raw = parseFeaturesArg(argv);
  if (raw === null) return null;

  const requestedKeys = raw
    .split(',')
    .map((key) => key.trim())
    .filter((key) => key.length > 0);

  const featureIds = getFeatureIds();
  const byCliKey = new Map<string, FeatureId>();
  for (const featureId of featureIds) {
    byCliKey.set(featureId, featureId);
    byCliKey.set(featureIdToCliKey(featureId), featureId);
  }

  const selectedFeatureIds: FeatureId[] = [];
  const unknownKeys: string[] = [];
  for (const key of requestedKeys) {
    const featureId = byCliKey.get(key);
    if (!featureId) {
      unknownKeys.push(key);
      continue;
    }
    if (!selectedFeatureIds.includes(featureId)) {
      selectedFeatureIds.push(featureId);
    }
  }

  if (requestedKeys.length === 0) {
    errorMessage('--features requires a comma-separated feature list');
    process.exit(1);
  }

  if (unknownKeys.length > 0) {
    const validKeys = featureIds.map(featureIdToCliKey).join(', ');
    errorMessage(`Unknown feature key(s): ${unknownKeys.join(', ')}\nValid keys: ${validKeys}`);
    process.exit(1);
  }

  return selectedFeatureIds;
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
  const sortedEntries = sortAuditEntries(entries);
  const actionable = getActionableEntries(sortedEntries);

  return {
    actionable,
    entries: sortedEntries,
    missingCount: actionable.filter((entry) => entry.status === 'missing').length,
    partialCount: actionable.filter((entry) => entry.status === 'partial').length,
    target,
  };
}

function printManagedAuditSummary(
  results: ManagedAuditTargetResult[],
  requestedFeatureIds: readonly FeatureId[] | null,
): void {
  const actionableResults = results.filter(
    (result) => getSelectedActionableEntries(result, requestedFeatureIds).length > 0,
  );
  const cleanCount = results.length - actionableResults.length;

  infoMessage(
    `Managed audit: ${actionableResults.length} target(s) need repair${cleanCount > 0 ? `, ${cleanCount} up to date` : ''}`,
  );

  if (actionableResults.length === 0) return;

  logMessage(
    actionableResults
      .map((result, index) => {
        const number = `${index + 1}.`;
        const entries = getSelectedActionableEntries(result, requestedFeatureIds);
        return `${pc.gray(number)} ${pc.white(result.target.name)} ${pc.dim(`(${formatCount(entries)})`)}`;
      })
      .join('\n'),
  );
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
  const requestedFeatureIds = parseRequestedFeatureIds(argv);
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

  printManagedAuditSummary(auditResults, requestedFeatureIds);

  const actionableResults = auditResults.filter(
    (result) => getSelectedActionableEntries(result, requestedFeatureIds).length > 0,
  );
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

    const selectedActionableEntries = getSelectedActionableEntries(result, requestedFeatureIds);
    logMessage(`${pc.cyan(result.target.name)} ${pc.dim(result.target.path)}`);
    const selectedFeatureIds: FeatureId[] | null = requestedFeatureIds
      ? selectedActionableEntries.map((entry) => entry.feature.id)
      : await promptAuditSuggest(flow, result.entries);
    if (!selectedFeatureIds || selectedFeatureIds.length === 0) {
      skippedCount += 1;
      continue;
    }

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
