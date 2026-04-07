import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { PACKAGE_JSON } from 'config/constants.config';
import type { PackageJson } from 'types/package-json.types';
import { detectOxfmt } from './oxfmt.detect.js';
import { computeCanonicalOxfmtPackageJson } from './oxfmt.preview.js';
import { getOxfmtConfigCanonicalFileContent } from './oxfmt.template.js';

function formatPackageJsonString(packageJson: PackageJson): string {
  return `${JSON.stringify(packageJson, null, 2)}\n`;
}

describe('detectOxfmt', () => {
  it('returns false when preview finds non-package drift (e.g. workflow still uses dprint)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'oxfmt-detect-false-'));
    const base: PackageJson = {
      name: '@finografic/detect-pkg',
      version: '0.0.0',
      devDependencies: { oxfmt: '0.0.0', '@finografic/oxfmt-config': '0.0.0' },
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
});
