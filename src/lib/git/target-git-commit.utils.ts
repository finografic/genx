import { relative } from 'node:path';
import { execa } from 'execa';

export interface GitCommitTracker {
  gitRoot: string;
  beforeDirtyPaths: Set<string>;
}

export interface GitCommitResult {
  committed: boolean;
  hash?: string;
  message?: string;
}

function isInsideGitRoot(path: string): boolean {
  return path !== '' && !path.startsWith('..') && !path.startsWith('/');
}

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
