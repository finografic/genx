import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { PACKAGE_JSON } from 'config/constants.config';
import type { PackageJson } from 'types/package-json.types';
import { getChangedPreviewChanges } from '../../lib/feature-preview/feature-preview.utils.js';
import { OXFMT_UPDATE_SCRIPT } from './oxfmt.constants.js';
import { computeCanonicalOxfmtPackageJson, previewOxfmt } from './oxfmt.preview.js';
import { getOxfmtConfigCanonicalFileContent } from './oxfmt.template.js';

function formatPackageJsonString(packageJson: PackageJson): string {
  return `${JSON.stringify(packageJson, null, 2)}\n`;
}

describe('oxfmt.preview — package.json drift', () => {
  it('reports package.json changes when `update:oxfmt-config` is missing (legacy detect would still see format scripts)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'oxfmt-preview-drift-'));
    const pkg: PackageJson = {
      name: '@finografic/drift-pkg',
      version: '0.0.0',
      devDependencies: {
        oxfmt: '0.0.0',
        '@finografic/oxfmt-config': '0.0.0',
      },
      scripts: {
        'format:check': 'oxfmt --check',
        'format:fix': 'oxfmt',
      },
    };
    await writeFile(resolve(dir, PACKAGE_JSON), formatPackageJsonString(pkg), 'utf8');
    await writeFile(resolve(dir, 'oxfmt.config.ts'), getOxfmtConfigCanonicalFileContent(), 'utf8');

    const preview = await previewOxfmt({ targetDir: dir });
    const changed = getChangedPreviewChanges(preview.changes);
    const pkgChange = changed.find((c) => c.kind === 'write' && c.path.endsWith('package.json'));
    expect(pkgChange?.kind).toBe('write');
    if (pkgChange?.kind === 'write') {
      expect(pkgChange.proposedContent).toContain(OXFMT_UPDATE_SCRIPT.key);
      expect(pkgChange.currentContent).not.toContain(OXFMT_UPDATE_SCRIPT.key);
    }
  });

  it('reports no package.json preview change when canonical scripts and lint-staged already match', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'oxfmt-preview-ok-'));
    const base: PackageJson = {
      name: '@finografic/ok-pkg',
      version: '0.0.0',
      devDependencies: { oxfmt: '0.0.0', '@finografic/oxfmt-config': '0.0.0' },
    };
    const canonical = computeCanonicalOxfmtPackageJson(base);
    await writeFile(resolve(dir, PACKAGE_JSON), formatPackageJsonString(canonical), 'utf8');
    await writeFile(resolve(dir, 'oxfmt.config.ts'), getOxfmtConfigCanonicalFileContent(), 'utf8');

    const preview = await previewOxfmt({ targetDir: dir });
    const changed = getChangedPreviewChanges(preview.changes);
    expect(changed).toHaveLength(0);
    expect(preview.noopMessage).toBeDefined();
  });
});
