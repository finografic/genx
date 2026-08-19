import type { FlowContext } from '@finografic/cli-kit/flow';
import { infoMessage, warnMessage } from 'utils';
import type { FeatureId } from 'features/feature.types';

import { applyFeaturesToTarget, logFeatureResults } from 'lib/features/apply-features.runner';
import { readWorkspaceMembers } from 'lib/monorepo/monorepo.workspace';
import { pc } from 'utils/picocolors';

import { monorepoConfig } from 'config/monorepo.config';

import { promptWorkspaceMembers } from './workspace-members.prompt.js';

export interface WorkspaceFeaturePartition {
  /** Safe to apply to the workspace root. */
  root: FeatureId[];
  /** Applied per selected workspace member. */
  member: FeatureId[];
  /** Starter-owned toolchain — not applied anywhere by upgrade. */
  blocked: FeatureId[];
}

/**
 * Split selected features by where they may run in a workspace.
 *
 * The root list is `monorepoConfig.rootFeatures` — the same allowlist `create monorepo` applies —
 * so generation and upgrade cannot drift apart on what a workspace root may receive.
 */
export function partitionFeaturesForWorkspace(featureIds: FeatureId[]): WorkspaceFeaturePartition {
  const partition: WorkspaceFeaturePartition = { root: [], member: [], blocked: [] };

  for (const featureId of featureIds) {
    if (monorepoConfig.rootFeatures.includes(featureId)) {
      partition.root.push(featureId);
    } else if (monorepoConfig.memberFeatures.includes(featureId)) {
      partition.member.push(featureId);
    } else {
      partition.blocked.push(featureId);
    }
  }

  return partition;
}

/** Report features that a workspace root cannot receive, and why. */
export function reportBlockedWorkspaceFeatures(blocked: FeatureId[]): void {
  if (blocked.length === 0) return;

  warnMessage(
    `Skipped at the workspace root: ${blocked.map((id) => pc.yellow(id)).join(', ')}\n` +
      'These write single-package toolchain config — the starter already owns it at the root.',
  );
}

/**
 * Apply package-scoped features to workspace members.
 *
 * Each member is a normal single-package target, so features run unchanged against it and keep
 * their own per-file diff confirmation.
 */
export async function runWorkspaceMemberFeatures(params: {
  flow: FlowContext;
  targetDir: string;
  featureIds: FeatureId[];
}): Promise<void> {
  if (params.featureIds.length === 0) return;

  const members = await readWorkspaceMembers(params.targetDir);
  if (members.length === 0) {
    warnMessage(
      `No workspace members resolved from pnpm-workspace.yaml — skipping ${params.featureIds.join(', ')}`,
    );
    return;
  }

  const selectedPaths = await promptWorkspaceMembers(params.flow, members);
  if (selectedPaths.length === 0) {
    infoMessage('No workspace members selected.');
    return;
  }

  const selected = members.filter((member) => selectedPaths.includes(member.relativePath));
  for (const member of selected) {
    infoMessage(`Workspace member: ${pc.cyan(member.relativePath)}`);
    const results = await applyFeaturesToTarget(member.dir, params.featureIds, {
      commandName: 'upgrade',
      targetLabel: member.relativePath,
      yesAll: params.flow.yesMode,
    });
    logFeatureResults(results);
  }
}
