import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execa } from 'execa';
import { afterEach, describe, expect, it } from 'vitest';
import type { Feature } from 'features/feature.types';

import {
  commitFeatureGitChanges,
  createFeatureCommitSubject,
  createFeatureGitCommitTracker,
} from './feature-git-commit.utils.js';

const tempRoots: string[] = [];

const testFeature: Feature = {
  id: 'aiInstructions',
  label: 'AI Instructions (Copilot, Cursor rules)',
  apply: async () => ({ applied: [] }),
};

async function initRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'genx-feature-commit-'));
  tempRoots.push(root);

  await execa('git', ['init'], { cwd: root });
  await execa('git', ['config', 'user.name', 'Genx Test'], { cwd: root });
  await execa('git', ['config', 'user.email', 'genx@example.test'], { cwd: root });
  await writeFile(join(root, 'unrelated.txt'), 'before\n', 'utf8');
  await execa('git', ['add', 'unrelated.txt'], { cwd: root });
  await execa('git', ['commit', '-m', 'chore: initial'], { cwd: root });

  return root;
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('feature git commits', () => {
  it('formats the boilerplate feature commit subject', () => {
    expect(
      createFeatureCommitSubject({
        action: 'update',
        commandName: 'audit',
        feature: testFeature,
      }),
    ).toBe('feat(ai-instructions): genx audit used to update AI Instructions (Copilot, Cursor rules)');
  });

  it('commits feature paths and newly dirty side effects without committing pre-existing dirty files', async () => {
    const root = await initRepo();
    await writeFile(join(root, 'unrelated.txt'), 'before\nuser work\n', 'utf8');

    const tracker = await createFeatureGitCommitTracker(root);
    const featurePath = join(root, '.github/copilot-instructions.md');
    const lockfilePath = join(root, 'pnpm-lock.yaml');
    await mkdir(join(root, '.github'), { recursive: true });
    await writeFile(featurePath, 'instructions\n', 'utf8');
    await writeFile(lockfilePath, 'lockfile\n', 'utf8');

    const result = await commitFeatureGitChanges({
      action: 'update',
      appliedTargetPaths: [featurePath],
      commandName: 'audit',
      feature: testFeature,
      targetDir: root,
      tracker,
    });

    expect(result.committed).toBe(true);
    expect(await execa('git', ['show', '--name-only', '--format=', 'HEAD'], { cwd: root })).toMatchObject({
      stdout: '.github/copilot-instructions.md\npnpm-lock.yaml',
    });
    expect(await readFile(join(root, 'unrelated.txt'), 'utf8')).toBe('before\nuser work\n');
    expect(await execa('git', ['status', '--porcelain'], { cwd: root })).toMatchObject({
      stdout: ' M unrelated.txt',
    });
  });
});
