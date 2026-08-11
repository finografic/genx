import { execa } from 'execa';

export interface TargetGitChange {
  /** Porcelain index (staged) status code, or ' ' when unmodified. `?` for untracked. */
  index: string;
  path: string;
  /** Porcelain worktree (unstaged) status code, or ' ' when unmodified. `?` for untracked. */
  worktree: string;
}

export interface TargetGitStatus {
  /** Current branch name, or `null` when detached / unavailable. */
  branch: string | null;
  changes: TargetGitChange[];
  /** Number of paths with uncommitted changes (staged, unstaged, or untracked). */
  dirtyCount: number;
  isRepo: boolean;
}

/**
 * Parses `git status --porcelain=v1 -z` output into per-path status codes.
 *
 * The `-z` format is NUL-separated with no quoting, and rename/copy entries (`R`/`C`)
 * emit the origin path as a separate following record — that extra record is consumed
 * here rather than being mistaken for another change.
 */
export function parsePorcelainChanges(output: string): TargetGitChange[] {
  const entries = output.split('\0').filter(Boolean);
  const changes: TargetGitChange[] = [];

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (!entry || entry.length < 4) continue;

    changes.push({
      index: entry[0] ?? ' ',
      path: entry.slice(3),
      worktree: entry[1] ?? ' ',
    });

    // Rename/copy: the next record is the origin path, not a separate change.
    if (entry[0] === 'R' || entry[0] === 'C') index += 1;
  }

  return changes;
}

async function resolveGitRoot(targetDir: string): Promise<string | null> {
  try {
    const result = await execa('git', ['rev-parse', '--show-toplevel'], { cwd: targetDir });
    return result.stdout.trim();
  } catch {
    return null;
  }
}

/**
 * Read worktree cleanliness for a target directory.
 * Never throws — a non-repo (or unreadable) directory reports `isRepo: false`.
 */
export async function readTargetGitStatus(targetDir: string): Promise<TargetGitStatus> {
  const gitRoot = await resolveGitRoot(targetDir);
  if (gitRoot === null) return { branch: null, changes: [], dirtyCount: 0, isRepo: false };

  try {
    const [branchResult, statusResult] = await Promise.all([
      execa('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: gitRoot }),
      execa('git', ['status', '--porcelain=v1', '-z'], { cwd: gitRoot }),
    ]);

    const branch = branchResult.stdout.trim();
    const changes = parsePorcelainChanges(statusResult.stdout);

    return {
      branch: branch === '' || branch === 'HEAD' ? null : branch,
      changes,
      dirtyCount: changes.length,
      isRepo: true,
    };
  } catch {
    return { branch: null, changes: [], dirtyCount: 0, isRepo: true };
  }
}

/**
 * Read-only snapshot of pending work, for feeding an AI commit-message draft.
 *
 * Deliberately does NOT stage anything: drafts are generated ahead of time for targets
 * the user has not yet confirmed (and may skip), so this must not mutate the repo.
 * `git diff HEAD` therefore covers tracked edits only, and untracked files are reported
 * by name — their contents are not in the diff.
 */
export async function readTargetGitDiff(
  targetDir: string,
): Promise<{ diff: string; files: string[] } | null> {
  const gitRoot = await resolveGitRoot(targetDir);
  if (gitRoot === null) return null;

  try {
    const [diffResult, statusResult] = await Promise.all([
      execa('git', ['diff', 'HEAD'], { cwd: gitRoot, maxBuffer: 1024 * 1024 * 10 }),
      execa('git', ['status', '--porcelain=v1', '-z'], { cwd: gitRoot }),
    ]);

    const changes = parsePorcelainChanges(statusResult.stdout);
    if (changes.length === 0) return null;

    return { diff: diffResult.stdout, files: changes.map((change) => change.path) };
  } catch {
    return null;
  }
}
