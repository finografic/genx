import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { hasPreviewChanges } from '../../lib/feature-preview/feature-preview.utils.js';
import { detectGitHooks, isGitHooksFullyConfigured } from './git-hooks.detect.js';
import { previewGitHooks } from './git-hooks.preview.js';

describe('git-hooks preview-driven detect', () => {
  it('reports drift when package.json lacks git-hooks metadata', async () => {
    const root = await mkdtemp(join(tmpdir(), 'genx-gh-'));
    await writeFile(
      join(root, 'package.json'),
      `${JSON.stringify({ name: 'x', version: '1.0.0' }, null, 2)}\n`,
    );

    const preview = await previewGitHooks({ targetDir: root });
    expect(hasPreviewChanges(preview)).toBe(true);
    expect(preview.changes.map((change) => change.path).sort()).toEqual(
      [
        join(root, '.husky/commit-msg'),
        join(root, '.husky/pre-commit'),
        join(root, 'commitlint.config.mjs'),
        join(root, 'package.json'),
      ].sort(),
    );
    expect(await detectGitHooks({ targetDir: root })).toBe(false);
    expect(await isGitHooksFullyConfigured(root)).toBe(false);

    await rm(root, { recursive: true, force: true });
  });

  it('matches isGitHooksFullyConfigured and detectGitHooks after applying canonical husky package.json + hook files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'genx-gh-'));
    const pkg = {
      'name': 'x',
      'version': '1.0.0',
      'scripts': { prepare: 'husky' },
      'devDependencies': {
        '@commitlint/cli': 'latest',
        '@commitlint/config-conventional': 'latest',
        'husky': 'latest',
        'lint-staged': 'latest',
      },
      'lint-staged': { '*.{ts,tsx,js,jsx,mjs,cjs}': ['eslint --fix'] },
    };
    await writeFile(join(root, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);

    const previewPath = join(root, 'commitlint.config.mjs');
    const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
    const templateCommitlint = join(repoRoot, '_templates/commitlint.config.mjs');
    await writeFile(previewPath, await readFile(templateCommitlint, 'utf8'));
    await mkdir(join(root, '.husky'), { recursive: true });
    await writeFile(join(root, '.husky/pre-commit'), 'pnpm exec lint-staged --allow-empty\n');
    await writeFile(join(root, '.husky/commit-msg'), 'pnpm exec commitlint --edit "$1"\n');

    const preview = await previewGitHooks({ targetDir: root });
    expect(hasPreviewChanges(preview)).toBe(false);
    expect(await detectGitHooks({ targetDir: root })).toBe(true);
    expect(await isGitHooksFullyConfigured(root)).toBe(true);

    await rm(root, { recursive: true, force: true });
  });

  it('treats legacy simple-git-hooks allowBuilds in pnpm-workspace.yaml as drift', async () => {
    const root = await mkdtemp(join(tmpdir(), 'genx-gh-'));
    const pkg = {
      'name': 'x',
      'version': '1.0.0',
      'scripts': { prepare: 'husky' },
      'devDependencies': {
        '@commitlint/cli': 'latest',
        '@commitlint/config-conventional': 'latest',
        'husky': 'latest',
        'lint-staged': 'latest',
      },
      'lint-staged': { '*.{ts,tsx,js,jsx,mjs,cjs}': ['eslint --fix'] },
    };
    await writeFile(join(root, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);

    const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
    const templateCommitlint = join(repoRoot, '_templates/commitlint.config.mjs');
    await writeFile(join(root, 'commitlint.config.mjs'), await readFile(templateCommitlint, 'utf8'));
    await mkdir(join(root, '.husky'), { recursive: true });
    await writeFile(join(root, '.husky/pre-commit'), 'pnpm exec lint-staged --allow-empty\n');
    await writeFile(join(root, '.husky/commit-msg'), 'pnpm exec commitlint --edit "$1"\n');
    await writeFile(
      join(root, 'pnpm-workspace.yaml'),
      'allowBuilds:\n  esbuild: true\n  simple-git-hooks: true\n',
    );

    const preview = await previewGitHooks({ targetDir: root });
    expect(hasPreviewChanges(preview)).toBe(true);
    expect(preview.changes.some((change) => change.path === join(root, 'pnpm-workspace.yaml'))).toBe(true);
    expect(await detectGitHooks({ targetDir: root })).toBe(false);

    await rm(root, { recursive: true, force: true });
  });
});
