import { getFeature } from 'features/feature-registry';
import { errorMessage, infoMessage, successMessage, warnMessage } from 'utils';
import type { AuditStatus, Feature, FeatureId } from 'features/feature.types';

import { pc } from 'utils/picocolors';

import { validateExistingPackage } from '../../utils/validation.utils.js';
import { commitFeatureGitChanges, createFeatureGitCommitTracker } from './feature-git-commit.utils.js';

export interface ApplyFeaturesToTargetOptions {
  commandName?: string;
  commitEachFeature?: boolean;
  yesAll?: boolean;
}

export interface ApplyFeaturesToTargetResult {
  appliedFeatures: FeatureId[];
  noopMessages: string[];
}

function actionForAuditStatus(status: AuditStatus): 'add' | 'update' {
  return status === 'missing' ? 'add' : 'update';
}

async function resolveFeatureAction(feature: Feature, targetDir: string): Promise<'add' | 'update'> {
  if (feature.audit) {
    const audit = await feature.audit({ targetDir });
    return actionForAuditStatus(audit.status);
  }

  return 'add';
}

export async function applyFeaturesToTarget(
  targetDir: string,
  selectedFeatureIds: FeatureId[],
  options: ApplyFeaturesToTargetOptions = {},
): Promise<ApplyFeaturesToTargetResult> {
  const validation = validateExistingPackage(targetDir);
  if (!validation.ok) {
    errorMessage(validation.reason || 'Not a valid package directory');
    process.exit(1);
  }

  const appliedFeatures: FeatureId[] = [];
  const noopMessages: string[] = [];
  const commitEachFeature = options.commitEachFeature !== false;
  const commandName = options.commandName ?? 'features';

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

    const commitAction = await resolveFeatureAction(feature, targetDir);
    const tracker = commitEachFeature ? await createFeatureGitCommitTracker(targetDir) : null;
    const result = await feature.apply({ targetDir, yesAll: options.yesAll });
    if (result.error) {
      errorMessage(result.error.message);
      process.exit(1);
      return { appliedFeatures, noopMessages };
    }

    if (result.applied.length > 0) {
      appliedFeatures.push(featureId);

      if (commitEachFeature) {
        try {
          const commitResult = await commitFeatureGitChanges({
            action: commitAction,
            appliedTargetPaths: result.appliedTargetPaths ?? [],
            commandName,
            feature,
            targetDir,
            tracker,
          });

          if (commitResult.committed) {
            successMessage(`Committed ${featureId}: ${commitResult.hash}`);
          } else if (tracker) {
            infoMessage(`No Git commit needed for ${featureId}`);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          warnMessage(`Applied ${featureId}, but Git commit failed: ${message}`);
        }
      }
    } else {
      noopMessages.push(result.noopMessage ?? `${feature.label} already installed. No changes made.`);
    }
  }

  return { appliedFeatures, noopMessages };
}

export function logFeatureResults(results: ApplyFeaturesToTargetResult): void {
  if (results.appliedFeatures.length > 0) {
    successMessage(`Applied features: ${results.appliedFeatures.join(', ')}`);
    for (const msg of results.noopMessages) {
      console.log(pc.dim(msg));
    }
    return;
  }

  infoMessage('No changes made');
  for (const msg of results.noopMessages) {
    console.log(pc.dim(msg));
  }
}
