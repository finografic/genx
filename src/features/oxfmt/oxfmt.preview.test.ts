import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { PACKAGE_JSON } from 'config/constants.config';
import type { PackageJson } from 'types/package-json.types';
import {
  getChangedPreviewChanges,
  hasPreviewChanges,
} from '../../lib/feature-preview/feature-preview.utils.js';
import { OXFMT_UPDATE_SCRIPT } from './oxfmt.constants.js';
import { computeCanonicalOxfmtPackageJson, previewOxfmt } from './oxfmt.preview.js';
import { getOxfmtConfigCanonicalFileContent } from './oxfmt.template.js';

function formatPackageJsonString(packageJson: PackageJson): string {
  return `${JSON.stringify(packageJson, null, 2)}\n`;
}

/** Apply write preview proposals until stable — builds an aligned tree for detection tests. */
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

  it('reports no package.json preview change when canonical layout already matches', async () => {
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
    const pkgJsonChanges = changed.filter((c) => c.kind === 'write' && c.path.endsWith('package.json'));
    expect(pkgJsonChanges).toHaveLength(0);
  });
});

describe('oxfmt.preview — non-package.json drift', () => {
  it('reports workflow changes when GitHub workflow still runs dprint', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'oxfmt-preview-wf-'));
    const base: PackageJson = {
      name: '@finografic/wf-pkg',
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
    const wfPath = resolve(dir, '.github/workflows/ci.yml');
    await writeFile(wfPath, `jobs:\n  x:\n    steps:\n      - run: pnpm dprint check\n`, 'utf8');

    const preview = await previewOxfmt({ targetDir: dir });
    const changed = getChangedPreviewChanges(preview.changes);
    const wfChange = changed.find((c) => c.kind === 'write' && c.path.endsWith('ci.yml'));
    expect(wfChange?.kind).toBe('write');
    if (wfChange?.kind === 'write') {
      expect(wfChange.proposedContent).toContain('pnpm format:check');
      expect(wfChange.currentContent).toContain('dprint');
    }
  });
});

describe('oxfmt.preview — Prettier config backup', () => {
  it('proposes renameBackup to a sibling --backup path (not delete)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'oxfmt-preview-prettier-'));
    const base: PackageJson = {
      name: '@finografic/prettier-backup',
      version: '0.0.0',
      devDependencies: { oxfmt: '0.0.0', '@finografic/oxfmt-config': '0.0.0' },
    };
    await writeFile(
      resolve(dir, PACKAGE_JSON),
      formatPackageJsonString(computeCanonicalOxfmtPackageJson(base)),
      'utf8',
    );
    await writeFile(resolve(dir, 'oxfmt.config.ts'), getOxfmtConfigCanonicalFileContent(), 'utf8');
    await writeFile(resolve(dir, '.prettierrc'), '{}\n', 'utf8');

    const preview = await previewOxfmt({ targetDir: dir });
    const prettierChange = getChangedPreviewChanges(preview.changes).find(
      (c) => c.kind === 'renameBackup' && c.path.endsWith('.prettierrc'),
    );
    expect(prettierChange?.kind).toBe('renameBackup');
    if (prettierChange?.kind === 'renameBackup') {
      expect(prettierChange.path).toBe(resolve(dir, '.prettierrc'));
      expect(prettierChange.backupPath).toBe(resolve(dir, '.prettierrc--backup'));
    }
  });

  it('uses the next free backup name when `.prettierrc--backup` already exists', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'oxfmt-preview-prettier-coll-'));
    const base: PackageJson = {
      name: '@finografic/prettier-coll',
      version: '0.0.0',
      devDependencies: { oxfmt: '0.0.0', '@finografic/oxfmt-config': '0.0.0' },
    };
    await writeFile(
      resolve(dir, PACKAGE_JSON),
      formatPackageJsonString(computeCanonicalOxfmtPackageJson(base)),
      'utf8',
    );
    await writeFile(resolve(dir, 'oxfmt.config.ts'), getOxfmtConfigCanonicalFileContent(), 'utf8');
    await writeFile(resolve(dir, '.prettierrc'), '{}\n', 'utf8');
    await writeFile(resolve(dir, '.prettierrc--backup'), '{}\n', 'utf8');

    const preview = await previewOxfmt({ targetDir: dir });
    const prettierChange = getChangedPreviewChanges(preview.changes).find(
      (c) => c.kind === 'renameBackup' && c.path.endsWith('.prettierrc'),
    );
    expect(prettierChange?.kind).toBe('renameBackup');
    if (prettierChange?.kind === 'renameBackup') {
      expect(prettierChange.backupPath).toBe(resolve(dir, '.prettierrc--backup-2'));
    }
  });
});

describe('oxfmt.preview — converge + detection alignment', () => {
  it('after converging writes, preview reports no remaining drift', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'oxfmt-preview-converge-'));
    const base: PackageJson = {
      name: '@finografic/conv-pkg',
      version: '0.0.0',
      devDependencies: { oxfmt: '0.0.0', '@finografic/oxfmt-config': '0.0.0' },
    };
    await writeFile(
      resolve(dir, PACKAGE_JSON),
      formatPackageJsonString(computeCanonicalOxfmtPackageJson(base)),
      'utf8',
    );
    await writeFile(resolve(dir, 'oxfmt.config.ts'), getOxfmtConfigCanonicalFileContent(), 'utf8');

    await convergePreviewWrites(dir);

    const finalPreview = await previewOxfmt({ targetDir: dir });
    expect(hasPreviewChanges(finalPreview)).toBe(false);
  });
});

describe('oxfmt.preview — needsInstall', () => {
  it('omits needsInstall when package.json diff does not change dependency fields', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'oxfmt-preview-needsinst-'));
    const base: PackageJson = {
      name: '@finografic/needsinst-a',
      version: '0.0.0',
      devDependencies: { oxfmt: '0.0.0', '@finografic/oxfmt-config': '0.0.0' },
    };
    const canonical = computeCanonicalOxfmtPackageJson(base);
    const scripts = { ...(canonical.scripts ?? {}) };
    delete scripts[OXFMT_UPDATE_SCRIPT.key];
    const drifted: PackageJson = { ...canonical, scripts };
    await writeFile(resolve(dir, PACKAGE_JSON), formatPackageJsonString(drifted), 'utf8');
    await writeFile(resolve(dir, 'oxfmt.config.ts'), getOxfmtConfigCanonicalFileContent(), 'utf8');

    const preview = await previewOxfmt({ targetDir: dir });
    expect(
      getChangedPreviewChanges(preview.changes).some(
        (c) => c.kind === 'write' && c.path.endsWith('package.json'),
      ),
    ).toBe(true);
    expect(preview.needsInstall).toBeFalsy();
  });

  it('sets needsInstall when dependency lists change', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'oxfmt-preview-needsinst-b-'));
    const pkg: PackageJson = {
      name: '@finografic/needsinst-b',
      version: '0.0.0',
      scripts: { test: 'echo ok' },
    };
    await writeFile(resolve(dir, PACKAGE_JSON), formatPackageJsonString(pkg), 'utf8');
    await writeFile(resolve(dir, 'oxfmt.config.ts'), getOxfmtConfigCanonicalFileContent(), 'utf8');

    const preview = await previewOxfmt({ targetDir: dir });
    expect(preview.needsInstall).toBe(true);
  });
});
