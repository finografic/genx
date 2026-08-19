import type { Feature, FeatureId } from 'features/feature.types';

import type { GitCommitResult, GitCommitTracker } from 'lib/git/target-git-commit.utils';
import { commitTrackedGitChanges, createGitCommitTracker } from 'lib/git/target-git-commit.utils';

type FeatureCommitAction = 'add' | 'update';
type FeatureGitCommitTracker = GitCommitTracker;
type FeatureGitCommitResult = GitCommitResult;

export const createFeatureGitCommitTracker = createGitCommitTracker;

export function featureIdToCommitScope(featureId: FeatureId): string {
  return featureId.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}

/**
 * Build the commit subject for one applied feature.
 *
 * `targetLabel` names the workspace member the feature was applied to. Without it a workspace-wide
 * run produces one indistinguishable subject per member, so `git log` cannot say which package each
 * commit touched.
 */
export function createFeatureCommitSubject(params: {
  action: FeatureCommitAction;
  commandName: string;
  feature: Feature;
  targetLabel?: string | undefined;
}): string {
  const scope = featureIdToCommitScope(params.feature.id);
  const target = params.targetLabel ? ` in ${params.targetLabel}` : '';
  return `feat(${scope}): ${params.action} ${params.feature.label}${target} via genx ${params.commandName}`;
}

export async function commitFeatureGitChanges(params: {
  action: FeatureCommitAction;
  appliedTargetPaths: readonly string[];
  commandName: string;
  feature: Feature;
  targetDir: string;
  targetLabel?: string | undefined;
  tracker: FeatureGitCommitTracker | null;
}): Promise<FeatureGitCommitResult> {
  return commitTrackedGitChanges({
    explicitTargetPaths: params.appliedTargetPaths,
    message: createFeatureCommitSubject(params),
    tracker: params.tracker,
  });
}
