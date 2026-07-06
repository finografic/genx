import { relative } from 'node:path';
import { execa } from 'execa';
import type { Feature, FeatureId } from 'features/feature.types';

type FeatureCommitAction = 'add' | 'update';

interface FeatureGitCommitTracker {
  gitRoot: string;
  beforeDirtyPaths: Set<string>;
}

export interface FeatureGitCommitResult {
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

export async function createFeatureGitCommitTracker(
  targetDir: string,
): Promise<FeatureGitCommitTracker | null> {
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

export function featureIdToCommitScope(featureId: FeatureId): string {
  return featureId.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}

export function createFeatureCommitSubject(params: {
  action: FeatureCommitAction;
  commandName: string;
  feature: Feature;
}): string {
  const scope = featureIdToCommitScope(params.feature.id);
  return `feat(${scope}): genx ${params.commandName} used to ${params.action} ${params.feature.label}`;
}

export async function commitFeatureGitChanges(params: {
  action: FeatureCommitAction;
  appliedTargetPaths: readonly string[];
  commandName: string;
  feature: Feature;
  targetDir: string;
  tracker: FeatureGitCommitTracker | null;
}): Promise<FeatureGitCommitResult> {
  if (!params.tracker || params.appliedTargetPaths.length === 0) {
    return { committed: false };
  }

  const afterDirtyPaths = await getDirtyPaths(params.tracker.gitRoot);
  const candidatePaths = new Set<string>();

  for (const path of params.appliedTargetPaths) {
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

  const message = createFeatureCommitSubject(params);
  await execa('git', ['add', '--', ...commitPaths], { cwd: params.tracker.gitRoot });
  try {
    await execa('git', ['commit', '-m', message, '--only', '--', ...commitPaths], {
      cwd: params.tracker.gitRoot,
    });
  } catch (error) {
    await execa('git', ['restore', '--staged', '--', ...commitPaths], { cwd: params.tracker.gitRoot }).catch(
      () => undefined,
    );
    throw error;
  }
  const hash = (await execa('git', ['rev-parse', '--short', 'HEAD'], { cwd: params.tracker.gitRoot })).stdout;

  return { committed: true, hash, message };
}
