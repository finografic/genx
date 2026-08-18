import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { ToolchainPolicy } from '@finografic/deps-policy/deps.types';

import { fileExists } from 'utils/fs.utils';

import type { PackageJson } from 'types/package-json.types';

export interface ToolchainChange {
  target: '.nvmrc' | 'engines.node' | 'engines.pnpm' | 'packageManager';
  from?: string;
  to: string;
}

interface CurrentToolchainState {
  nvmrc?: string;
  enginesNode?: string;
  /** Absent when the target does not declare one — see `planToolchainChanges`. */
  enginesPnpm?: string;
  packageManager?: string;
}

/**
 * Read the current toolchain-relevant values from a target project.
 */
async function readCurrentToolchainState(
  targetDir: string,
  packageJson: PackageJson,
): Promise<CurrentToolchainState> {
  const state: CurrentToolchainState = {};

  const nvmrcPath = resolve(targetDir, '.nvmrc');
  if (fileExists(nvmrcPath)) {
    try {
      state.nvmrc = (await readFile(nvmrcPath, 'utf8')).trim();
    } catch {
      // ignore
    }
  }

  const engines = packageJson['engines'] as Record<string, string> | undefined;
  state.enginesNode = engines?.['node'];
  state.enginesPnpm = engines?.['pnpm'];

  state.packageManager = packageJson['packageManager'] as string | undefined;

  return state;
}

/**
 * Plan toolchain version changes for a target project.
 * Compares `.nvmrc`, `engines.node`, `engines.pnpm` and `packageManager` against policy.
 */
export async function planToolchainChanges(
  targetDir: string,
  packageJson: PackageJson,
  tc: ToolchainPolicy,
): Promise<ToolchainChange[]> {
  const current = await readCurrentToolchainState(targetDir, packageJson);
  const changes: ToolchainChange[] = [];

  if (current.nvmrc !== tc.node) {
    changes.push({ target: '.nvmrc', from: current.nvmrc, to: tc.node });
  }

  const wantEngines = `>=${tc.node}`;
  if (current.enginesNode !== wantEngines) {
    changes.push({ target: 'engines.node', from: current.enginesNode, to: wantEngines });
  }

  // Only aligned when the target already declares it — adding an engines.pnpm floor to a package
  // that deliberately has none would impose a constraint nobody asked for. But when it *is*
  // declared and left behind, it contradicts packageManager in the same file: deps-xscan sat at
  // `engines.pnpm: "10.x"` with `packageManager: pnpm@11.14.0`, and pnpm obeys packageManager, so
  // every install failed its own engine check with ERR_PNPM_UNSUPPORTED_ENGINE.
  const wantEnginesPnpm = `>=${tc.pnpm}`;
  if (current.enginesPnpm !== undefined && current.enginesPnpm !== wantEnginesPnpm) {
    changes.push({ target: 'engines.pnpm', from: current.enginesPnpm, to: wantEnginesPnpm });
  }

  const wantPm = `pnpm@${tc.pnpm}`;
  if (current.packageManager !== wantPm) {
    changes.push({ target: 'packageManager', from: current.packageManager, to: wantPm });
  }

  return changes;
}

/**
 * Apply toolchain changes to a target project's filesystem and package.json.
 * Returns the updated package.json (caller should write it to disk).
 */
export async function applyToolchainChanges(
  targetDir: string,
  packageJson: PackageJson,
  changes: ToolchainChange[],
): Promise<PackageJson> {
  let pkg = { ...packageJson };

  for (const change of changes) {
    if (change.target === '.nvmrc') {
      await writeFile(resolve(targetDir, '.nvmrc'), `${change.to}\n`, 'utf8');
    } else if (change.target === 'engines.node') {
      const engines = (pkg['engines'] ?? {}) as Record<string, string>;
      engines['node'] = change.to;
      pkg = { ...pkg, engines };
    } else if (change.target === 'engines.pnpm') {
      const engines = (pkg['engines'] ?? {}) as Record<string, string>;
      engines['pnpm'] = change.to;
      pkg = { ...pkg, engines };
    } else if (change.target === 'packageManager') {
      pkg = { ...pkg, packageManager: change.to };
    }
  }

  return pkg;
}
