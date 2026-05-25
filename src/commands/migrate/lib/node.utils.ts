import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { fileExists } from 'utils/fs.utils';

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
 * Handles formats like "24.3.0", "v24.3.0", "24", etc.
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

  const nvmrcPath = resolve(targetDir, '.nvmrc');
  if (fileExists(nvmrcPath)) {
    try {
      const content = await readFile(nvmrcPath, 'utf8');
      state.nvmrc = content.trim();
    } catch {
      // Ignore read errors
    }
  }

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
 * Plan Node runtime changes (.nvmrc, GitHub Actions) from a bare node version string.
 */
export function planNodeRuntimeChanges(current: CurrentNodeState, nodeVersion: string): NodeChange[] {
  const changes: NodeChange[] = [];

  if (current.nvmrc !== nodeVersion) {
    changes.push({ target: '.nvmrc', from: current.nvmrc, to: nodeVersion });
  }

  const major = detectNodeMajor(nodeVersion);
  const ciVersion = major ? `${major}.x` : nodeVersion;
  if (current.githubActionsNode !== ciVersion) {
    changes.push({ target: 'github-actions-node', from: current.githubActionsNode, to: ciVersion });
  }

  return changes;
}

/**
 * Plan @types/node change. Uses the version from deps-policy devDependencies.
 */
export function planNodeTypesChange(
  currentTypesVersion: string | undefined,
  policyTypesVersion: string,
): NodeChange | null {
  if (currentTypesVersion !== policyTypesVersion) {
    return { target: '@types/node', from: currentTypesVersion, to: policyTypesVersion };
  }
  return null;
}

/**
 * Apply Node runtime changes to filesystem.
 */
export async function applyNodeRuntimeChanges(targetDir: string, changes: NodeChange[]): Promise<void> {
  for (const change of changes) {
    if (change.target === '.nvmrc') {
      const nvmrcPath = resolve(targetDir, '.nvmrc');
      await writeFile(nvmrcPath, `${change.to}\n`, 'utf8');
    } else if (change.target === 'github-actions-node') {
      const workflowPath = resolve(targetDir, '.github/workflows/release.yml');
      if (fileExists(workflowPath)) {
        const content = await readFile(workflowPath, 'utf8');
        const updated = content.replace(/node-version:\s*.+/, `node-version: ${change.to}`);
        await writeFile(workflowPath, updated, 'utf8');
      }
    }
  }
}

/**
 * Apply @types/node change to package.json.
 */
export function applyNodeTypesChange(packageJson: PackageJson, change: NodeChange): PackageJson {
  const next = { ...packageJson };
  const devDeps = next.devDependencies ?? {};
  devDeps['@types/node'] = change.to;
  next.devDependencies = devDeps;
  return next;
}
