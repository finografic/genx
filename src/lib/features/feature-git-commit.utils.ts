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

export function createFeatureCommitSubject(params: {
  action: FeatureCommitAction;
  commandName: string;
  feature: Feature;
}): string {
  const scope = featureIdToCommitScope(params.feature.id);
  return `feat(${scope}): genx ${params.commandName} used to ${params.action} ${params.feature.label}`;
}

export async function commitFeatureGitChanges(params: {
  action: FeatureCommitAction;
  appliedTargetPaths: readonly string[];
  commandName: string;
  feature: Feature;
  targetDir: string;
  tracker: FeatureGitCommitTracker | null;
}): Promise<FeatureGitCommitResult> {
  return commitTrackedGitChanges({
    explicitTargetPaths: params.appliedTargetPaths,
    message: createFeatureCommitSubject(params),
    tracker: params.tracker,
  });
}
