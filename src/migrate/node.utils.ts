import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { fileExists } from 'utils/fs.utils';
import type { NodePolicy } from 'config/node.policy';
import type { PackageJson } from 'types/package-json.types';

export interface NodeChange {
  target: '.nvmrc' | 'github-actions-node' | '@types/node';
  from?: string;
  to: string;
}

export interface CurrentNodeState {
  nvmrc?: string;
  githubActionsNode?: string;
}

/**
 * Detect the major version from a Node version string.
 * Handles formats like "24.12.0", "v24.12.0", "24", etc.
 */
export function detectNodeMajor(version: string): number | null {
  const match = version.match(/^v?(\d+)/);
  return match ? Number(match[1]) : null;
}

/**
 * Detect current Node state from filesystem.
 */
export async function detectCurrentNodeState(targetDir: string): Promise<CurrentNodeState> {
  const state: CurrentNodeState = {};

  // Check .nvmrc
  const nvmrcPath = resolve(targetDir, '.nvmrc');
  if (fileExists(nvmrcPath)) {
    try {
      const content = await readFile(nvmrcPath, 'utf8');
      state.nvmrc = content.trim();
    } catch {
      // Ignore read errors
    }
  }

  // Check GitHub Actions workflow
  const workflowPath = resolve(targetDir, '.github/workflows/release.yml');
  if (fileExists(workflowPath)) {
    try {
      const content = await readFile(workflowPath, 'utf8');
      const nodeVersionMatch = content.match(/node-version:\s*(.+)/);
      if (nodeVersionMatch) {
        state.githubActionsNode = nodeVersionMatch[1].trim();
      }
    } catch {
      // Ignore read errors
    }
  }

  return state;
}

/**
 * Plan Node runtime changes (.nvmrc, GitHub Actions).
 */
export function planNodeRuntimeChanges(
  current: CurrentNodeState,
  policy: NodePolicy,
): NodeChange[] {
  const changes: NodeChange[] = [];

  if (current.nvmrc !== policy.local.nvmrc) {
    changes.push({
      target: '.nvmrc',
      from: current.nvmrc,
      to: policy.local.nvmrc,
    });
  }

  if (current.githubActionsNode !== policy.ci.githubActions) {
    changes.push({
      target: 'github-actions-node',
      from: current.githubActionsNode,
      to: policy.ci.githubActions,
    });
  }

  return changes;
}

/**
 * Plan @types/node change.
 */
export function planNodeTypesChange(
  currentTypesVersion: string | undefined,
  policy: NodePolicy,
): NodeChange | null {
  if (currentTypesVersion !== policy.types.node) {
    return {
      target: '@types/node',
      from: currentTypesVersion,
      to: policy.types.node,
    };
  }
  return null;
}

/**
 * Apply Node runtime changes to filesystem.
 */
export async function applyNodeRuntimeChanges(
  targetDir: string,
  changes: NodeChange[],
): Promise<void> {
  for (const change of changes) {
    if (change.target === '.nvmrc') {
      const nvmrcPath = resolve(targetDir, '.nvmrc');
      await writeFile(nvmrcPath, `${change.to}\n`, 'utf8');
    } else if (change.target === 'github-actions-node') {
      const workflowPath = resolve(targetDir, '.github/workflows/release.yml');
      if (fileExists(workflowPath)) {
        const content = await readFile(workflowPath, 'utf8');
        const updated = content.replace(
          /node-version:\s*.+/,
          `node-version: ${change.to}`,
        );
        await writeFile(workflowPath, updated, 'utf8');
      }
    }
  }
}

/**
 * Apply @types/node change to package.json.
 */
export function applyNodeTypesChange(
  packageJson: PackageJson,
  change: NodeChange,
): PackageJson {
  const next = { ...packageJson };
  const devDeps = (next.devDependencies as Record<string, string> | undefined) ?? {};
  devDeps['@types/node'] = change.to;
  next.devDependencies = devDeps;
  return next;
}
