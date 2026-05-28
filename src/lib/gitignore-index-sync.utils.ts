import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function isGitRepository(targetDir: string): Promise<boolean> {
  try {
    await execFileAsync('git', ['rev-parse', '--is-inside-work-tree'], { cwd: targetDir });
    return true;
  } catch {
    return false;
  }
}

async function listTrackedRelativePaths(
  targetDir: string,
  relativePaths: readonly string[],
): Promise<string[]> {
  const tracked: string[] = [];
  for (const rel of relativePaths) {
    try {
      await execFileAsync('git', ['ls-files', '--error-unmatch', rel], { cwd: targetDir });
      tracked.push(rel);
    } catch {
      // not tracked
    }
  }
  return tracked;
}

/**
 * Stop tracking paths that should be gitignored but remain in the index.
 * Returns relative paths removed from the index (file kept on disk).
 */
export async function untrackGitignoredPathsIfNeeded(
  targetDir: string,
  relativePaths: readonly string[],
): Promise<string[]> {
  if (relativePaths.length === 0) {
    return [];
  }
  if (!(await isGitRepository(targetDir))) {
    return [];
  }

  const existing = [];
  for (const rel of relativePaths) {
    if (await pathExists(join(targetDir, rel))) {
      existing.push(rel);
    }
  }

  const tracked = await listTrackedRelativePaths(targetDir, existing);
  if (tracked.length === 0) {
    return [];
  }

  await execFileAsync('git', ['rm', '--cached', '--quiet', '--', ...tracked], { cwd: targetDir });
  return tracked;
}
