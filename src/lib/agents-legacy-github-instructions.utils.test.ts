import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  collectLegacyGithubInstructionsChanges,
  rewriteLegacyGithubInstructionsPaths,
} from './agents-legacy-github-instructions.utils.js';

async function createRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'genx-legacy-inst-'));
  await mkdir(join(root, '.github/instructions/code'), { recursive: true });
  await mkdir(join(root, '.agents/instructions/code'), { recursive: true });
  return root;
}

describe('collectLegacyGithubInstructionsChanges', () => {
  it('deletes a legacy file the canonical tree already has', async () => {
    const root = await createRepo();
    await writeFile(join(root, '.github/instructions/code/style.instructions.md'), 'old\n');
    await writeFile(join(root, '.agents/instructions/code/style.instructions.md'), 'new\n');

    const changes = await collectLegacyGithubInstructionsChanges({
      targetDir: root,
      canonicalRoot: join(root, '.agents/instructions'),
    });

    expect(changes).toHaveLength(1);
    expect(changes[0]?.kind).toBe('delete');
    expect(changes[0]?.path).toBe(join(root, '.github/instructions/code/style.instructions.md'));

    await rm(root, { recursive: true, force: true });
  });

  it('carries project-specific content across before deleting it', async () => {
    // Nothing under `project/` is shipped by the shared config, so deleting it outright would lose
    // work the project authored.
    const root = await createRepo();
    await mkdir(join(root, '.github/instructions/project'), { recursive: true });
    await writeFile(join(root, '.github/instructions/project/house.instructions.md'), 'house rules\n');

    const changes = await collectLegacyGithubInstructionsChanges({
      targetDir: root,
      canonicalRoot: join(root, '.agents/instructions'),
    });

    const write = changes.find((change) => change.kind === 'write');
    expect(write?.path).toBe(join(root, '.agents/instructions/project/house.instructions.md'));
    expect(changes.some((change) => change.kind === 'delete')).toBe(true);

    await rm(root, { recursive: true, force: true });
  });

  it('removes junk without trying to move it', async () => {
    const root = await createRepo();
    await writeFile(join(root, '.github/instructions/.DS_Store'), 'junk');

    const changes = await collectLegacyGithubInstructionsChanges({
      targetDir: root,
      canonicalRoot: join(root, '.agents/instructions'),
    });

    expect(changes).toHaveLength(1);
    expect(changes[0]?.kind).toBe('delete');

    await rm(root, { recursive: true, force: true });
  });

  it('proposes nothing when the legacy directory is gone', async () => {
    const root = await mkdtemp(join(tmpdir(), 'genx-legacy-inst-'));

    await expect(
      collectLegacyGithubInstructionsChanges({
        targetDir: root,
        canonicalRoot: join(root, '.agents/instructions'),
      }),
    ).resolves.toEqual([]);

    await rm(root, { recursive: true, force: true });
  });
});

describe('rewriteLegacyGithubInstructionsPaths', () => {
  it('repoints every reference at the canonical directory', () => {
    const before = 'See `.github/instructions/code/x.md` and `.github/instructions/git/y.md`.';

    expect(rewriteLegacyGithubInstructionsPaths(before)).toBe(
      'See `.agents/instructions/code/x.md` and `.agents/instructions/git/y.md`.',
    );
  });

  it('leaves unrelated content untouched', () => {
    const content = 'Nothing to see. `.github/workflows/ci.yml` stays put.';

    expect(rewriteLegacyGithubInstructionsPaths(content)).toBe(content);
  });
});
