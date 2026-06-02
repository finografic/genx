import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { PACKAGE_JSON } from 'config/constants.config';
import type { PackageJson } from 'types/package-json.types';

import { getChangedPreviewChanges } from '../../lib/feature-preview/feature-preview.utils.js';
import { auditOxcConfig, detectOxcConfig } from './oxc-config.detect.js';
import { computeCanonicalOxfmtPackageJson, previewOxcConfig } from './oxc-config.preview.js';
import {
  getOxfmtConfigCanonicalFileContent,
  getOxlintConfigCanonicalFileContent,
} from './oxc-config.template.js';

function formatPackageJsonString(packageJson: PackageJson): string {
  return `${JSON.stringify(packageJson, null, 2)}\n`;
}

/** Apply write preview proposals until stable (same idea as oxfmt.preview tests). */
async function convergePreviewWrites(targetDir: string, maxIterations = 8): Promise<void> {
  for (let i = 0; i < maxIterations; i++) {
    const preview = await previewOxcConfig({ targetDir });
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

describe('detectOxcConfig', () => {
  it('returns false when preview finds non-package drift (e.g. ci.yml missing format:check)', async () => {
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
      `jobs:\n  x:\n    steps:\n      - run: pnpm lint\n`,
      'utf8',
    );

    await expect(detectOxcConfig({ targetDir: dir })).resolves.toBe(false);
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

    await expect(detectOxcConfig({ targetDir: dir })).resolves.toBe(true);
  });
});

describe('auditOxcConfig', () => {
  it('returns installed when only supplemental workflow drift exists', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'oxfmt-audit-installed-ci-'));
    const base: PackageJson = {
      name: '@finografic/audit-ci-pkg',
      version: '0.0.0',
      devDependencies: {
        'oxfmt': '0.0.0',
        'oxlint': '0.0.0',
        'oxlint-tsgolint': '0.0.0',
        '@finografic/oxc-config': '0.0.0',
      },
    };
    await writeFile(
      resolve(dir, PACKAGE_JSON),
      formatPackageJsonString(computeCanonicalOxfmtPackageJson(base)),
      'utf8',
    );
    await writeFile(resolve(dir, 'oxfmt.config.ts'), getOxfmtConfigCanonicalFileContent(), 'utf8');
    await writeFile(resolve(dir, 'oxlint.config.ts'), getOxlintConfigCanonicalFileContent(base), 'utf8');
    await mkdir(resolve(dir, '.github/workflows'), { recursive: true });
    await writeFile(
      resolve(dir, '.github/workflows/ci.yml'),
      `jobs:\n  x:\n    steps:\n      - run: pnpm lint\n`,
      'utf8',
    );

    await expect(auditOxcConfig({ targetDir: dir })).resolves.toEqual({ status: 'installed' });
  });

  it('returns installed when only VS Code settings drift exists', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'oxfmt-audit-installed-vscode-'));
    const base: PackageJson = {
      name: '@finografic/audit-vscode-pkg',
      version: '0.0.0',
      keywords: ['genx:type:cli'],
      devDependencies: {
        'oxfmt': '0.0.0',
        'oxlint': '0.0.0',
        'oxlint-tsgolint': '0.0.0',
        '@finografic/oxc-config': '0.0.0',
      },
    };
    await writeFile(
      resolve(dir, PACKAGE_JSON),
      formatPackageJsonString(computeCanonicalOxfmtPackageJson(base)),
      'utf8',
    );
    await writeFile(resolve(dir, 'oxfmt.config.ts'), getOxfmtConfigCanonicalFileContent(), 'utf8');
    await writeFile(resolve(dir, 'oxlint.config.ts'), getOxlintConfigCanonicalFileContent(base), 'utf8');
    await mkdir(resolve(dir, '.vscode'), { recursive: true });
    await writeFile(
      resolve(dir, '.vscode/settings.json'),
      `{
  "npm.packageManager": "pnpm",
  "editor.formatOnSave": true,
  "editor.formatOnSaveMode": "file",
  "editor.defaultFormatter": "oxc.oxc-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.oxc": "explicit",
    "source.organizeImports": "never",
    "source.sortImports": "explicit",
    "source.addMissingImports": "explicit"
  },
  "eslint.enable": false,
  "prettier.enable": false,
  "oxc.typeAware": true,
  "oxc.lint.run": "onSave",
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.preferences.preferTypeOnlyAutoImports": true,
  "[javascript]": { "editor.defaultFormatter": "oxc.oxc-vscode" },
  "[typescript]": { "editor.defaultFormatter": "oxc.oxc-vscode" },
  "[json]": { "editor.defaultFormatter": "oxc.oxc-vscode" },
  "[jsonc]": { "editor.defaultFormatter": "oxc.oxc-vscode" },
  "[yaml]": { "editor.defaultFormatter": "oxc.oxc-vscode" },
  "[toml]": { "editor.defaultFormatter": "oxc.oxc-vscode" },
  "[markdown]": {
    "editor.defaultFormatter": "oxc.oxc-vscode",
    "editor.formatOnSave": true
  },
  "markdownlint.config": {
    "default": true
  },
  "markdown.styles": [".vscode/markdown-github-light.css"]
}
`,
      'utf8',
    );

    await expect(auditOxcConfig({ targetDir: dir })).resolves.toEqual({ status: 'installed' });
  });

  it('returns installed when oxlint.config.ts drift is only cosmetic import ordering', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'oxfmt-audit-installed-oxlint-cosmetic-'));
    const base: PackageJson = {
      name: '@finografic/audit-oxlint-cosmetic-pkg',
      version: '0.0.0',
      keywords: ['genx:type:cli'],
      devDependencies: {
        'oxfmt': '0.0.0',
        'oxlint': '0.0.0',
        'oxlint-tsgolint': '0.0.0',
        '@finografic/oxc-config': '0.0.0',
      },
    };
    await writeFile(
      resolve(dir, PACKAGE_JSON),
      formatPackageJsonString(computeCanonicalOxfmtPackageJson(base)),
      'utf8',
    );
    await writeFile(resolve(dir, 'oxfmt.config.ts'), getOxfmtConfigCanonicalFileContent(), 'utf8');
    await writeFile(
      resolve(dir, 'oxlint.config.ts'),
      `import { oxlintCliConfig, testOverrides, configOverrides } from '@finografic/oxc-config/oxlint';
import { defineConfig } from 'oxlint';
import type { OxlintConfig } from 'oxlint';

export default defineConfig({
  ...oxlintCliConfig,
  overrides: [testOverrides, configOverrides],
} satisfies OxlintConfig);
`,
      'utf8',
    );

    await expect(auditOxcConfig({ targetDir: dir })).resolves.toEqual({ status: 'installed' });
  });

  it('returns partial when core package.json drift exists', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'oxfmt-audit-partial-core-'));
    const pkg: PackageJson = {
      name: '@finografic/audit-core-pkg',
      version: '0.0.0',
      devDependencies: {
        'oxfmt': '0.0.0',
        '@finografic/oxc-config': '0.0.0',
      },
    };
    await writeFile(resolve(dir, PACKAGE_JSON), formatPackageJsonString(pkg), 'utf8');
    await writeFile(resolve(dir, 'oxfmt.config.ts'), getOxfmtConfigCanonicalFileContent(), 'utf8');

    await expect(auditOxcConfig({ targetDir: dir })).resolves.toEqual({
      status: 'partial',
      detail: 'config out of date',
    });
  });

  it('returns missing when the primary package is not installed', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'oxfmt-audit-missing-'));
    const pkg: PackageJson = {
      name: '@finografic/audit-missing-pkg',
      version: '0.0.0',
      devDependencies: {},
    };
    await writeFile(resolve(dir, PACKAGE_JSON), formatPackageJsonString(pkg), 'utf8');

    await expect(auditOxcConfig({ targetDir: dir })).resolves.toEqual({ status: 'missing' });
  });
});
