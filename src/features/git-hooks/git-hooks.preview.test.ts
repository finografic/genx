import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
    expect(await detectGitHooks({ targetDir: root })).toBe(false);
    expect(await isGitHooksFullyConfigured(root)).toBe(false);

    await rm(root, { recursive: true, force: true });
  });

  it('matches isGitHooksFullyConfigured and detectGitHooks after applying canonical package.json + commitlint file', async () => {
    const root = await mkdtemp(join(tmpdir(), 'genx-gh-'));
    const pkg = {
      name: 'x',
      version: '1.0.0',
      scripts: { prepare: 'simple-git-hooks' },
      devDependencies: {
        '@commitlint/cli': 'latest',
        '@commitlint/config-conventional': 'latest',
        'lint-staged': 'latest',
        'simple-git-hooks': 'latest',
      },
      'lint-staged': { '*.{ts,tsx,js,jsx,mjs,cjs}': ['eslint --fix'] },
      'simple-git-hooks': { 'pre-commit': 'npx lint-staged --allow-empty' },
    };
    await writeFile(join(root, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);

    const previewPath = join(root, 'commitlint.config.mjs');
    const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
    const templateCommitlint = join(repoRoot, '_templates/commitlint.config.mjs');
    await writeFile(previewPath, await readFile(templateCommitlint, 'utf8'));

    const preview = await previewGitHooks({ targetDir: root });
    expect(hasPreviewChanges(preview)).toBe(false);
    expect(await detectGitHooks({ targetDir: root })).toBe(true);
    expect(await isGitHooksFullyConfigured(root)).toBe(true);

    await rm(root, { recursive: true, force: true });
  });
});
