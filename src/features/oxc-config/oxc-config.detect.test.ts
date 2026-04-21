import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { PACKAGE_JSON } from 'config/constants.config';
import type { PackageJson } from 'types/package-json.types';

import { getChangedPreviewChanges } from '../../lib/feature-preview/feature-preview.utils.js';
import { detectOxfmt } from './oxc-config.detect.js';
import { computeCanonicalOxfmtPackageJson, previewOxfmt } from './oxc-config.preview.js';
import { getOxfmtConfigCanonicalFileContent } from './oxc-config.template.js';

function formatPackageJsonString(packageJson: PackageJson): string {
  return `${JSON.stringify(packageJson, null, 2)}\n`;
}

/** Apply write preview proposals until stable (same idea as oxc-config.preview tests). */
async function convergePreviewWrites(targetDir: string, maxIterations = 8): Promise<void> {
  for (let i = 0; i < maxIterations; i++) {
    const preview = await previewOxfmt({ targetDir });
    const changed = getChangedPreviewChanges(preview.changes);
    if (changed.length === 0) return;

    for (const ch of changed) {
      if (ch.kind === 'write') {
        await mkdir(dirname(ch.path), { recursive: true });
        await writeFile(ch.path, ch.proposedContent, 'utf8');
      }
    }
  }
}

describe('detectOxfmt', () => {
  it('returns false when preview finds non-package drift (e.g. workflow still uses dprint)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'oxfmt-detect-false-'));
    const base: PackageJson = {
      name: '@finografic/detect-pkg',
      version: '0.0.0',
      devDependencies: { 'oxfmt': '0.0.0', '@finografic/oxc-config': '0.0.0' },
    };
    await writeFile(
      resolve(dir, PACKAGE_JSON),
      formatPackageJsonString(computeCanonicalOxfmtPackageJson(base)),
      'utf8',
    );
    await writeFile(resolve(dir, 'oxfmt.config.ts'), getOxfmtConfigCanonicalFileContent(), 'utf8');
    await mkdir(resolve(dir, '.github/workflows'), { recursive: true });
    await writeFile(
      resolve(dir, '.github/workflows/ci.yml'),
      `jobs:\n  x:\n    steps:\n      - run: pnpm dprint check\n`,
      'utf8',
    );

    await expect(detectOxfmt({ targetDir: dir })).resolves.toBe(false);
  });

  it('returns true after the tree converges to canonical oxfmt preview outputs', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'oxfmt-detect-true-'));
    const base: PackageJson = {
      name: '@finografic/clean-pkg',
      version: '0.0.0',
      devDependencies: { 'oxfmt': '0.0.0', '@finografic/oxc-config': '0.0.0' },
    };
    await writeFile(
      resolve(dir, PACKAGE_JSON),
      formatPackageJsonString(computeCanonicalOxfmtPackageJson(base)),
      'utf8',
    );
    await writeFile(resolve(dir, 'oxfmt.config.ts'), getOxfmtConfigCanonicalFileContent(), 'utf8');

    await convergePreviewWrites(dir);

    await expect(detectOxfmt({ targetDir: dir })).resolves.toBe(true);
  });
});
