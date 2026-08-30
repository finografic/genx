import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import fastGlob from 'fast-glob';
import { parse as parseYaml } from 'yaml';

import { fileExists } from 'utils/fs.utils';

import type { PackageJson } from 'types/package-json.types';

/** Root `package.json` keyword marking a pnpm workspace root generated or adopted by genx. */
export const MONOREPO_WORKSPACE_KEYWORD = 'genx:workspace:monorepo';

export const PNPM_WORKSPACE_FILE = 'pnpm-workspace.yaml';

export interface WorkspaceManifest {
  /** Absolute path to a `package.json` governed by policy. */
  packageJsonPath: string;
  /** Path relative to the workspace root; empty string for the root manifest itself. */
  label: string;
}

export interface WorkspaceMember {
  /** Path relative to the workspace root, POSIX separators — e.g. `apps/client`. */
  relativePath: string;
  /** Absolute path to the member directory. */
  dir: string;
  /** The member's declared package name, when it has one. */
  name?: string;
}

/**
 * True when `targetDir` is a pnpm workspace root.
 *
 * The keyword is authoritative, matching how `genx:type:*` beats package-type heuristics. The
 * fallback exists because monorepos generated before the marker — and any workspace adopted by
 * hand — carry no keyword, and refusing to recognise them would make the root behave like a single
 * package, which is the failure this detection exists to prevent.
 *
 * The fallback requires a non-empty `packages:` list, **not** merely the presence of
 * `pnpm-workspace.yaml`. Since pnpm 10 that file also carries `allowBuilds`,
 * `onlyBuiltDependencies` and `minimumReleaseAgeExclude` for ordinary single packages — genx and
 * cli-kit both have one — so its existence says nothing about whether a workspace exists.
 */
export async function isMonorepoRoot(targetDir: string, packageJson: PackageJson): Promise<boolean> {
  const keywords = Array.isArray(packageJson.keywords) ? packageJson.keywords : [];
  if (keywords.includes(MONOREPO_WORKSPACE_KEYWORD)) return true;

  const patterns = await readWorkspacePatterns(targetDir);
  return patterns.length > 0;
}

/** Read the raw `packages:` globs from `pnpm-workspace.yaml`, or `[]` when there are none. */
export async function readWorkspacePatterns(targetDir: string): Promise<string[]> {
  const workspacePath = resolve(targetDir, PNPM_WORKSPACE_FILE);
  if (!fileExists(workspacePath)) return [];

  let parsed: unknown;
  try {
    parsed = parseYaml(await readFile(workspacePath, 'utf8'));
  } catch {
    // A malformed workspace file is the repo's problem to fix; treating it as "no members" keeps
    // upgrade on the single-package path rather than crashing mid-run.
    return [];
  }

  if (typeof parsed !== 'object' || parsed === null) return [];
  const { packages } = parsed as { packages?: unknown };
  if (!Array.isArray(packages)) return [];

  return packages.filter((entry): entry is string => typeof entry === 'string');
}

/**
 * Resolve workspace members: every directory matched by the `packages:` globs that actually holds a
 * `package.json`. Sorted by path so runs are reproducible.
 */
export async function readWorkspaceMembers(targetDir: string): Promise<WorkspaceMember[]> {
  const patterns = await readWorkspacePatterns(targetDir);
  if (patterns.length === 0) return [];

  // pnpm's `packages:` entries name directories; fast-glob needs each to end in a path segment it
  // can match. Negations are passed through untouched so `!packages/private-*` still excludes.
  const globs = patterns.map((pattern) => (pattern.startsWith('!') ? pattern : pattern.replace(/\/$/, '')));

  const matches = await fastGlob(globs, {
    cwd: targetDir,
    onlyDirectories: true,
    absolute: false,
    dot: false,
    followSymbolicLinks: false,
    ignore: ['**/node_modules/**'],
  });

  const members: WorkspaceMember[] = [];
  for (const relativePath of matches.toSorted()) {
    const dir = resolve(targetDir, relativePath);
    const packageJsonPath = resolve(dir, 'package.json');
    if (!fileExists(packageJsonPath)) continue;

    let name: string | undefined;
    try {
      const parsed = JSON.parse(await readFile(packageJsonPath, 'utf8')) as PackageJson;
      name = typeof parsed.name === 'string' ? parsed.name : undefined;
    } catch {
      // An unreadable member manifest still identifies a real directory; the path is enough.
    }

    members.push({ relativePath, dir, ...(name ? { name } : {}) });
  }

  return members;
}

/**
 * Every manifest policy applies to: the target's own `package.json`, plus each workspace member's
 * when the target is a monorepo root.
 *
 * A monorepo keeps its real dependencies in `packages/*` and `apps/*`, so a root-only sync reports
 * "already aligned" while the members drift — which is exactly how they fell behind.
 */
export async function collectWorkspaceManifests(
  targetDir: string,
  rootPackageJson: PackageJson,
): Promise<WorkspaceManifest[]> {
  const manifests: WorkspaceManifest[] = [{ packageJsonPath: resolve(targetDir, 'package.json'), label: '' }];

  if (!(await isMonorepoRoot(targetDir, rootPackageJson))) return manifests;

  for (const member of await readWorkspaceMembers(targetDir)) {
    manifests.push({
      packageJsonPath: resolve(member.dir, 'package.json'),
      label: member.relativePath,
    });
  }

  return manifests;
}
