import { lstat, readlink, rm, symlink } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { execa } from 'execa';

export interface GitCommitTracker {
  gitRoot: string;
  beforeDirtyPaths: Set<string>;
}

export interface GitCommitResult {
  /** Branch the commit landed on, when known. */
  branch?: string;
  committed: boolean;
  hash?: string;
  message?: string;
  /** Git's own summary line, e.g. `7 files changed, 93 insertions(+), 40 deletions(-)`. */
  stat?: string;
  /** Separate commit made first to clear a type change — see {@link findStagedTypeChanges}. */
  preludeCommit?: GitCommitResult;
}

export interface StagedEntry {
  /** Porcelain status letter(s): `A`, `D`, `M`, `R100`, … */
  status: string;
  /** Path the entry refers to now — the destination side of a rename or copy. */
  path: string;
}

/** Parse `git diff --cached --name-status -z` into entries. */
export function parseStagedNameStatus(output: string): StagedEntry[] {
  const entries: StagedEntry[] = [];
  const fields = output.split('\0').filter((field) => field !== '');

  for (let index = 0; index < fields.length; index += 1) {
    const status = fields[index];
    if (!status) continue;

    // A rename or copy carries two paths; the second is where the content lives now.
    const pathOffset = status.startsWith('R') || status.startsWith('C') ? 2 : 1;
    const path = fields[index + pathOffset];
    index += pathOffset;

    if (path) entries.push({ status, path });
  }

  return entries;
}

/**
 * Staged paths that make the index unstashable.
 *
 * Replacing a tracked directory with a symlink stages an addition at the directory's path plus a
 * deletion of every file that was inside it. Those deletions now sit *beyond* the new symlink, and
 * git refuses to read through one:
 *
 *     error: '.claude/skills/foo/SKILL.md' is beyond a symbolic link
 *     fatal: Unable to process path .claude/skills/foo/SKILL.md
 *
 * `git stash create` fails on that, and lint-staged takes exactly that stash as its backup before
 * running any task — so the commit aborts with `Failed to back up original state` and not one check
 * runs. Committing the two halves separately avoids it without resorting to `--no-verify`, which
 * would disable lint and format on the commit.
 *
 * @returns Added paths whose prefix is also staged as deleted.
 */
export function findStagedTypeChanges(entries: readonly StagedEntry[]): string[] {
  const deleted = entries.filter((entry) => entry.status.startsWith('D')).map((entry) => entry.path);
  if (deleted.length === 0) return [];

  return entries
    .filter((entry) => entry.status.startsWith('A'))
    .map((entry) => entry.path)
    .filter((path) => deleted.some((deletedPath) => deletedPath.startsWith(`${path}/`)));
}

/** Pathspec suffix for git commands, empty when the caller wants the whole tree. */
function pathspec(paths: readonly string[] | undefined): string[] {
  return paths && paths.length > 0 ? ['--', ...paths] : [];
}

async function stageAll(gitRoot: string, paths?: readonly string[]): Promise<void> {
  await execa('git', ['add', '-A', ...pathspec(paths)], { cwd: gitRoot });
}

async function readStagedEntries(gitRoot: string, paths?: readonly string[]): Promise<StagedEntry[]> {
  const result = await execa('git', ['diff', '--cached', '--name-status', '-z', ...pathspec(paths)], {
    cwd: gitRoot,
  });
  return parseStagedNameStatus(result.stdout);
}

/**
 * Commit the deletion half of a type change on its own, then restage the symlinks.
 *
 * The symlinks are taken out of the working tree for the duration: with one still in place git
 * cannot read the staged deletions beneath it, so staging only the deletions is not enough on its
 * own — verified 2026-08-24.
 *
 * @returns The prelude commit, or `undefined` when there was nothing to split.
 */
async function commitTypeChangePrelude(params: {
  gitRoot: string;
  entries: readonly StagedEntry[];
  message: string;
  paths?: readonly string[];
}): Promise<GitCommitResult | undefined> {
  const typeChanges = findStagedTypeChanges(params.entries);
  if (typeChanges.length === 0) return undefined;

  const links: Array<{ path: string; target: string }> = [];
  for (const path of typeChanges) {
    const absolute = join(params.gitRoot, path);
    const stats = await lstat(absolute);
    // Only a symlink can be recreated exactly from what we can read here. Anything else is left
    // staged and the caller's single commit proceeds — failing loudly beats losing content.
    if (!stats.isSymbolicLink()) return undefined;
    links.push({ path, target: await readlink(absolute) });
  }

  for (const link of links) {
    await rm(join(params.gitRoot, link.path));
  }

  try {
    await stageAll(params.gitRoot, params.paths);
    await execa('git', ['commit', '-m', params.message, ...pathspec(params.paths)], {
      cwd: params.gitRoot,
    });
  } finally {
    // Restore the symlinks even when the commit was rejected, so a failed hook never leaves the
    // repository missing the files the installer just wrote.
    for (const link of links) {
      await symlink(link.target, join(params.gitRoot, link.path)).catch(() => undefined);
    }
    await stageAll(params.gitRoot, params.paths).catch(() => undefined);
  }

  const hash = (await execa('git', ['rev-parse', '--short', 'HEAD'], { cwd: params.gitRoot })).stdout;

  return { committed: true, hash, message: params.message };
}

function isInsideGitRoot(path: string): boolean {
  return path !== '' && !path.startsWith('..') && !path.startsWith('/');
}

/**
 * Paths touched, for commit tracking. Unlike `parsePorcelainChanges` in
 * target-git-status.utils.ts, a rename's origin path is kept too — staging a rename
 * needs both sides.
 */
function parsePorcelainPaths(output: string): Set<string> {
  const paths = new Set<string>();
  const entries = output.split('\0').filter(Boolean);

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (!entry || entry.length < 4) continue;

    const status = entry.slice(0, 2);
    const path = entry.slice(3);
    paths.add(path);

    if (status[0] === 'R' || status[0] === 'C') {
      index += 1;
      const renamedPath = entries[index];
      if (renamedPath) paths.add(renamedPath);
    }
  }

  return paths;
}

async function getDirtyPaths(cwd: string): Promise<Set<string>> {
  const result = await execa('git', ['status', '--porcelain=v1', '-z'], { cwd });
  return parsePorcelainPaths(result.stdout);
}

export async function createGitCommitTracker(targetDir: string): Promise<GitCommitTracker | null> {
  try {
    const result = await execa('git', ['rev-parse', '--show-toplevel'], { cwd: targetDir });
    const gitRoot = result.stdout.trim();
    return {
      gitRoot,
      beforeDirtyPaths: await getDirtyPaths(gitRoot),
    };
  } catch {
    return null;
  }
}

export async function commitTrackedGitChanges(params: {
  explicitTargetPaths: readonly string[];
  message: string;
  tracker: GitCommitTracker | null;
}): Promise<GitCommitResult> {
  if (!params.tracker || params.explicitTargetPaths.length === 0) {
    return { committed: false };
  }

  const afterDirtyPaths = await getDirtyPaths(params.tracker.gitRoot);
  const candidatePaths = new Set<string>();

  for (const path of params.explicitTargetPaths) {
    const gitRelativePath = relative(params.tracker.gitRoot, path);
    if (isInsideGitRoot(gitRelativePath)) {
      candidatePaths.add(gitRelativePath);
    }
  }

  for (const path of afterDirtyPaths) {
    if (!params.tracker.beforeDirtyPaths.has(path)) {
      candidatePaths.add(path);
    }
  }

  const commitPaths = [...candidatePaths].filter((path) => afterDirtyPaths.has(path));
  if (commitPaths.length === 0) {
    return { committed: false };
  }

  await execa('git', ['add', '--', ...commitPaths], { cwd: params.tracker.gitRoot });
  try {
    await execa('git', ['commit', '-m', params.message, '--only', '--', ...commitPaths], {
      cwd: params.tracker.gitRoot,
    });
  } catch (error) {
    await execa('git', ['restore', '--staged', '--', ...commitPaths], { cwd: params.tracker.gitRoot }).catch(
      () => undefined,
    );
    throw error;
  }
  const hash = (await execa('git', ['rev-parse', '--short', 'HEAD'], { cwd: params.tracker.gitRoot })).stdout;

  return { committed: true, hash, message: params.message };
}

/**
 * Stage everything in the target repo and commit it in one go — the `git add -A`
 * semantics of the `_gcai` shell helper.
 *
 * Unlike `commitTrackedGitChanges` (which commits only paths a tracker observed
 * changing), this deliberately sweeps in whatever is already dirty, so the caller
 * must have shown the user that file list first.
 *
 * Throws on failure — a rejected commit hook is the caller's to report.
 *
 * `typeChangeMessage` opts into splitting a directory-to-symlink replacement into its own preceding
 * commit; without it the single commit is attempted as before. See {@link findStagedTypeChanges}.
 *
 * `paths` narrows the sweep to a pathspec. A caller running inside a larger command must pass it:
 * `upgrade` leaves the whole tree dirty by design, so an unscoped sweep would file every operation's
 * work under whatever message this call happens to carry.
 */
export async function commitAllChanges(
  targetDir: string,
  message: string,
  options?: { typeChangeMessage?: string; paths?: readonly string[] },
): Promise<GitCommitResult> {
  const gitRoot = (await execa('git', ['rev-parse', '--show-toplevel'], { cwd: targetDir })).stdout.trim();
  const paths = options?.paths;

  await stageAll(gitRoot, paths);

  const entries = await readStagedEntries(gitRoot, paths);
  if (entries.length === 0) return { committed: false };

  const preludeCommit = options?.typeChangeMessage
    ? await commitTypeChangePrelude({ gitRoot, entries, message: options.typeChangeMessage, paths })
    : undefined;

  // The prelude consumed part of the index; what is left may be nothing at all.
  if (preludeCommit && (await readStagedEntries(gitRoot, paths)).length === 0) {
    return { ...preludeCommit, preludeCommit: undefined };
  }

  const commit = await execa('git', ['commit', '-m', message, ...pathspec(paths)], { cwd: gitRoot });

  const [hashResult, branchResult] = await Promise.all([
    execa('git', ['rev-parse', '--short', 'HEAD'], { cwd: gitRoot }),
    execa('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: gitRoot }),
  ]);

  // Git prints its own tally (`7 files changed, 93 insertions(+), ...`) — reuse it rather
  // than recomputing, so the numbers always match what git itself reports.
  const stat = commit.stdout
    .split('\n')
    .map((line) => line.trim())
    .find((line) => /\bfiles? changed\b/.test(line));

  const branch = branchResult.stdout.trim();

  return {
    branch: branch === '' || branch === 'HEAD' ? undefined : branch,
    committed: true,
    hash: hashResult.stdout,
    message,
    stat,
    preludeCommit,
  };
}
