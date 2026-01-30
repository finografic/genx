import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { execa } from 'execa';

import type { PackageJson } from 'types/package-json.types';

export async function isDependencyDeclared(
  targetDir: string,
  packageName: string,
): Promise<boolean> {
  const packageJsonPath = resolve(targetDir, 'package.json');
  const raw = await readFile(packageJsonPath, 'utf8');
  const packageJson = JSON.parse(raw) as PackageJson;

  const dependencies =
    typeof packageJson.dependencies === 'object' && packageJson.dependencies !== null
      ? (packageJson.dependencies as Record<string, unknown>)
      : {};

  const devDependencies =
    typeof packageJson.devDependencies === 'object' && packageJson.devDependencies !== null
      ? (packageJson.devDependencies as Record<string, unknown>)
      : {};

  return (
    Object.prototype.hasOwnProperty.call(dependencies, packageName)
    || Object.prototype.hasOwnProperty.call(devDependencies, packageName)
  );
}

/**
 * Install a package as a dev dependency using pnpm.
 * Generic utility for feature installation.
 */
export async function installDevDependency(
  targetDir: string,
  packageName: string,
  version: string = 'latest',
): Promise<{ installed: boolean }> {
  // If it's already declared in package.json, treat this as a no-op and don't
  // run pnpm. This keeps feature application output accurate and avoids
  // rewriting lockfiles unnecessarily.
  if (await isDependencyDeclared(targetDir, packageName)) {
    return { installed: false };
  }

  try {
    // Note: we intentionally run pnpm here instead of editing package.json
    // directly, so lockfiles stay consistent.
    await execa('pnpm', ['add', '-D', `${packageName}@${version}`], {
      cwd: targetDir,
    });
    return { installed: true };
  } catch (error) {
    // If pnpm exits non-zero for an already-present dependency in some setups,
    // treat that as a non-failure. (This keeps feature application idempotent.)
    if (error instanceof Error && error.message.toLowerCase().includes('already')) {
      return { installed: false };
    }
    throw error;
  }
}

/**
 * Remove a package from dependencies and devDependencies using pnpm.
 * Only call when the package is known to be declared (e.g. after isDependencyDeclared).
 */
export async function removeDependency(
  targetDir: string,
  packageName: string,
): Promise<{ removed: boolean }> {
  if (!(await isDependencyDeclared(targetDir, packageName))) {
    return { removed: false };
  }

  await execa('pnpm', ['remove', packageName], { cwd: targetDir });
  return { removed: true };
}

/**
 * Check if any of the given dependencies are declared in package.json.
 * Useful for detecting feature categories (e.g., "has react" for frontend).
 */
export async function hasAnyDependency(
  targetDir: string,
  packageNames: string[],
): Promise<boolean> {
  for (const name of packageNames) {
    if (await isDependencyDeclared(targetDir, name)) {
      return true;
    }
  }
  return false;
}
