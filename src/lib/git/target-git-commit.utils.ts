import { relative } from 'node:path';
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
 */
export async function commitAllChanges(targetDir: string, message: string): Promise<GitCommitResult> {
  const gitRoot = (await execa('git', ['rev-parse', '--show-toplevel'], { cwd: targetDir })).stdout.trim();

  await execa('git', ['add', '-A'], { cwd: gitRoot });

  const staged = await execa('git', ['diff', '--cached', '--name-only'], { cwd: gitRoot });
  if (staged.stdout.trim() === '') return { committed: false };

  const commit = await execa('git', ['commit', '-m', message], { cwd: gitRoot });

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
  };
}
