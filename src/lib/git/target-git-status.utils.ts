import { execa } from 'execa';

import { parsePorcelainPaths } from './target-git-commit.utils.js';

export interface TargetGitStatus {
  /** Current branch name, or `null` when detached / unavailable. */
  branch: string | null;
  /** Number of paths with uncommitted changes (staged, unstaged, or untracked). */
  dirtyCount: number;
  dirtyPaths: string[];
  isRepo: boolean;
}

/**
 * Read worktree cleanliness for a target directory.
 * Never throws — a non-repo (or unreadable) directory reports `isRepo: false`.
 */
export async function readTargetGitStatus(targetDir: string): Promise<TargetGitStatus> {
  let gitRoot: string;
  try {
    gitRoot = (await execa('git', ['rev-parse', '--show-toplevel'], { cwd: targetDir })).stdout.trim();
  } catch {
    return { branch: null, dirtyCount: 0, dirtyPaths: [], isRepo: false };
  }

  try {
    const [branchResult, statusResult] = await Promise.all([
      execa('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: gitRoot }),
      execa('git', ['status', '--porcelain=v1', '-z'], { cwd: gitRoot }),
    ]);

    const branch = branchResult.stdout.trim();
    const dirtyPaths = [...parsePorcelainPaths(statusResult.stdout)];

    return {
      branch: branch === '' || branch === 'HEAD' ? null : branch,
      dirtyCount: dirtyPaths.length,
      dirtyPaths,
      isRepo: true,
    };
  } catch {
    return { branch: null, dirtyCount: 0, dirtyPaths: [], isRepo: true };
  }
}
