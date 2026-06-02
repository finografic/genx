import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { FeaturePreviewChangeWrite } from '../../lib/feature-preview/feature-preview.types.js';

import { PACKAGE_JSON } from 'config/constants.config';
import type { PackageJson } from 'types/package-json.types';

import {
  getChangedPreviewChanges,
  hasPreviewChanges,
} from '../../lib/feature-preview/feature-preview.utils.js';
import { OXFMT_UPDATE_SCRIPT } from './oxc-config.constants.js';
import { computeCanonicalOxfmtPackageJson, previewOxcConfig } from './oxc-config.preview.js';
import { getOxfmtConfigCanonicalFileContent } from './oxc-config.template.js';

function formatPackageJsonString(packageJson: PackageJson): string {
  return `${JSON.stringify(packageJson, null, 2)}\n`;
}

/** Apply write preview proposals until stable — builds an aligned tree for detection tests. */
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

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));

describe('oxc-config.template', () => {
  it('getOxfmtConfigCanonicalFileContent matches _templates/oxfmt.config.ts', async () => {
    const template = await readFile(join(repoRoot, '_templates/oxfmt.config.ts'), 'utf8');
    expect(getOxfmtConfigCanonicalFileContent()).toBe(template.endsWith('\n') ? template : `${template}\n`);
    expect(getOxfmtConfigCanonicalFileContent()).toMatch(
      /^import type \{ OxfmtConfig, OxfmtOverrideConfig \} from '@finografic\/oxc-config\/oxfmt';/m,
    );
  });
});

describe('oxfmt.preview — package.json drift', () => {
  it('removes associated legacy eslint and dprint dependencies from package.json', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'oxfmt-preview-legacy-deps-'));
    const pkg: PackageJson = {
      name: '@finografic/legacy-cleanup-pkg',
      version: '0.0.0',
      devDependencies: {
        '@eslint/js': '^9.39.2',
        '@finografic/dprint-config': '^0.12.4',
        '@finografic/oxc-config': '0.0.0',
        '@stylistic/eslint-plugin': '^5.6.1',
        'dprint': '^0.51.1',
        'eslint': '^9.39.2',
        'eslint-plugin-markdownlint': '^0.9.0',
        'globals': '^17.3.0',
        'oxfmt': '0.0.0',
        'oxlint': '0.0.0',
        'oxlint-tsgolint': '0.0.0',
      },
    };
    await writeFile(resolve(dir, PACKAGE_JSON), formatPackageJsonString(pkg), 'utf8');
    await writeFile(resolve(dir, 'oxfmt.config.ts'), getOxfmtConfigCanonicalFileContent(), 'utf8');

    const preview = await previewOxcConfig({ targetDir: dir });
    const changed = getChangedPreviewChanges(preview.changes);
    const pkgChange = changed.find(
      (c): c is FeaturePreviewChangeWrite => c.kind === 'write' && c.path.endsWith('package.json'),
    );
    expect(pkgChange).toBeDefined();
    expect(pkgChange!.proposedContent).not.toContain('"eslint":');
    expect(pkgChange!.proposedContent).not.toContain('"@eslint/js":');
    expect(pkgChange!.proposedContent).not.toContain('"dprint":');
    expect(pkgChange!.proposedContent).not.toContain('"@finografic/dprint-config":');
    expect(pkgChange!.proposedContent).toContain('"@finografic/oxc-config":');
    expect(pkgChange!.proposedContent).toContain('"oxfmt":');
  });

  it('reports package.json changes when `update:oxc-config` is missing (legacy detect would still see format scripts)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'oxfmt-preview-drift-'));
    const pkg: PackageJson = {
      name: '@finografic/drift-pkg',
      version: '0.0.0',
      devDependencies: {
        'oxfmt': '0.0.0',
        '@finografic/oxc-config': '0.0.0',
      },
      scripts: {
        'format:check': 'oxfmt --check',
        'format:fix': 'oxfmt',
      },
    };
    await writeFile(resolve(dir, PACKAGE_JSON), formatPackageJsonString(pkg), 'utf8');
    await writeFile(resolve(dir, 'oxfmt.config.ts'), getOxfmtConfigCanonicalFileContent(), 'utf8');

    const preview = await previewOxcConfig({ targetDir: dir });
    const changed = getChangedPreviewChanges(preview.changes);
    const pkgChange = changed.find(
      (c): c is FeaturePreviewChangeWrite => c.kind === 'write' && c.path.endsWith('package.json'),
    );
    expect(pkgChange).toBeDefined();
    expect(pkgChange!.proposedContent).toContain(OXFMT_UPDATE_SCRIPT.key);
    expect(pkgChange!.currentContent).not.toContain(OXFMT_UPDATE_SCRIPT.key);
  });

  it('reports no package.json preview change when canonical layout already matches', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'oxfmt-preview-ok-'));
    const base: PackageJson = {
      name: '@finografic/ok-pkg',
      version: '0.0.0',
      devDependencies: { 'oxfmt': '0.0.0', '@finografic/oxc-config': '0.0.0' },
    };
    const canonical = computeCanonicalOxfmtPackageJson(base);
    await writeFile(resolve(dir, PACKAGE_JSON), formatPackageJsonString(canonical), 'utf8');
    await writeFile(resolve(dir, 'oxfmt.config.ts'), getOxfmtConfigCanonicalFileContent(), 'utf8');

    const preview = await previewOxcConfig({ targetDir: dir });
    const changed = getChangedPreviewChanges(preview.changes);
    const pkgJsonChanges = changed.filter((c) => c.kind === 'write' && c.path.endsWith('package.json'));
    expect(pkgJsonChanges).toHaveLength(0);
  });
});

describe('oxfmt.preview — CI workflow drift', () => {
  it('reports ci.yml changes when format:check step is missing', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'oxfmt-preview-wf-'));
    const base: PackageJson = {
      name: '@finografic/wf-pkg',
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
    const wfPath = resolve(dir, '.github/workflows/ci.yml');
    await writeFile(wfPath, `jobs:\n  x:\n    steps:\n      - run: pnpm lint\n`, 'utf8');

    const preview = await previewOxcConfig({ targetDir: dir });
    const changed = getChangedPreviewChanges(preview.changes);
    const wfChange = changed.find(
      (c): c is FeaturePreviewChangeWrite => c.kind === 'write' && c.path.endsWith('ci.yml'),
    );
    expect(wfChange).toBeDefined();
    expect(wfChange!.proposedContent).toContain('pnpm format:check');
    expect(wfChange!.proposedContent).toContain('pnpm lint:ci');
  });
});

describe('oxfmt.preview — Prettier config removal', () => {
  it('proposes delete for Prettier config files', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'oxfmt-preview-prettier-'));
    const base: PackageJson = {
      name: '@finografic/prettier-remove',
      version: '0.0.0',
      devDependencies: { 'oxfmt': '0.0.0', '@finografic/oxc-config': '0.0.0' },
    };
    await writeFile(
      resolve(dir, PACKAGE_JSON),
      formatPackageJsonString(computeCanonicalOxfmtPackageJson(base)),
      'utf8',
    );
    await writeFile(resolve(dir, 'oxfmt.config.ts'), getOxfmtConfigCanonicalFileContent(), 'utf8');
    await writeFile(resolve(dir, '.prettierrc'), '{}\n', 'utf8');

    const preview = await previewOxcConfig({ targetDir: dir });
    const prettierChange = getChangedPreviewChanges(preview.changes).find(
      (c) => c.kind === 'delete' && c.path.endsWith('.prettierrc'),
    );
    expect(prettierChange).toBeDefined();
    expect(prettierChange!.kind).toBe('delete');
    expect(prettierChange!.path).toBe(resolve(dir, '.prettierrc'));
    expect(prettierChange!.summary).toBe('remove Prettier config (.prettierrc)');
  });

  it('proposes delete for associated legacy root config files', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'oxfmt-preview-legacy-files-'));
    const base: PackageJson = {
      name: '@finografic/legacy-root-remove',
      version: '0.0.0',
      devDependencies: {
        '@finografic/oxc-config': '0.0.0',
        'oxfmt': '0.0.0',
        'oxlint': '0.0.0',
        'oxlint-tsgolint': '0.0.0',
      },
    };
    await writeFile(
      resolve(dir, PACKAGE_JSON),
      formatPackageJsonString(computeCanonicalOxfmtPackageJson(base)),
      'utf8',
    );
    await writeFile(resolve(dir, 'oxfmt.config.ts'), getOxfmtConfigCanonicalFileContent(), 'utf8');
    await writeFile(resolve(dir, 'eslint.config.ts'), 'export default [];\n', 'utf8');
    await writeFile(resolve(dir, 'dprint.jsonc'), '{}\n', 'utf8');

    const preview = await previewOxcConfig({ targetDir: dir });
    const deleteChanges = getChangedPreviewChanges(preview.changes).filter((c) => c.kind === 'delete');

    expect(deleteChanges.some((c) => c.path === resolve(dir, 'eslint.config.ts'))).toBe(true);
    expect(deleteChanges.some((c) => c.path === resolve(dir, 'dprint.jsonc'))).toBe(true);

    const eslintDelete = deleteChanges.find((c) => c.path === resolve(dir, 'eslint.config.ts'));
    expect(eslintDelete).toBeDefined();
    expect(eslintDelete!.summary).toBe('remove legacy config (eslint.config.ts)');

    const dprintDelete = deleteChanges.find((c) => c.path === resolve(dir, 'dprint.jsonc'));
    expect(dprintDelete).toBeDefined();
    expect(dprintDelete!.summary).toBe('remove legacy config (dprint.jsonc)');
  });
});

describe('oxfmt.preview — VS Code settings', () => {
  it('preserves template codeActionsOnSave block (organizeImports never)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'oxfmt-preview-settings-'));
    const base: PackageJson = {
      name: '@finografic/settings-pkg',
      version: '0.0.0',
      devDependencies: { 'oxfmt': '0.0.0', '@finografic/oxc-config': '0.0.0' },
    };
    await writeFile(
      resolve(dir, PACKAGE_JSON),
      formatPackageJsonString(computeCanonicalOxfmtPackageJson(base)),
      'utf8',
    );
    await writeFile(resolve(dir, 'oxfmt.config.ts'), getOxfmtConfigCanonicalFileContent(), 'utf8');
    await mkdir(resolve(dir, '.vscode'), { recursive: true });
    await writeFile(
      resolve(dir, '.vscode/settings.json'),
      `${JSON.stringify(
        {
          'editor.codeActionsOnSave': {
            'source.fixAll.oxc': 'explicit',
            'source.organizeImports': 'never',
            'source.sortImports': 'explicit',
            'source.addMissingImports': 'explicit',
          },
        },
        null,
        2,
      )}\n`,
      'utf8',
    );

    const preview = await previewOxcConfig({ targetDir: dir });
    const settingsChange = getChangedPreviewChanges(preview.changes).find(
      (c): c is FeaturePreviewChangeWrite => c.kind === 'write' && c.path.endsWith('.vscode/settings.json'),
    );
    expect(settingsChange).toBeDefined();
    expect(settingsChange!.proposedContent).toContain('"source.organizeImports": "never"');
    expect(settingsChange!.proposedContent).toContain('"source.sortImports": "explicit"');
    expect(settingsChange!.proposedContent).not.toContain('"source.organizeImports": "explicit"');
  });

  it('removes legacy dprint and redundant eslint settings and reorders canonical groups', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'oxfmt-preview-settings-legacy-'));
    const base: PackageJson = {
      name: '@finografic/settings-legacy-pkg',
      version: '0.0.0',
      devDependencies: {
        '@finografic/oxc-config': '0.0.0',
        'oxfmt': '0.0.0',
        'oxlint': '0.0.0',
        'oxlint-tsgolint': '0.0.0',
      },
    };
    await writeFile(
      resolve(dir, PACKAGE_JSON),
      formatPackageJsonString(computeCanonicalOxfmtPackageJson(base)),
      'utf8',
    );
    await writeFile(resolve(dir, 'oxfmt.config.ts'), getOxfmtConfigCanonicalFileContent(), 'utf8');
    await mkdir(resolve(dir, '.vscode'), { recursive: true });
    await writeFile(
      resolve(dir, '.vscode/settings.json'),
      `{
  "npm.packageManager": "pnpm",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "eslint.enable": true,
  "eslint.useFlatConfig": true,
  "eslint.format.enable": true,
  "prettier.enable": false,
  "dprint.experimentalLsp": true,
  "dprint.verbose": true,
  "[javascript]": {
    "editor.defaultFormatter": "dprint.dprint"
  },
  "markdown.styles": ["node_modules/@finografic/md-lint/styles/markdown-github-light.css"]
}
`,
      'utf8',
    );

    const preview = await previewOxcConfig({ targetDir: dir });
    const settingsChange = getChangedPreviewChanges(preview.changes).find(
      (c): c is FeaturePreviewChangeWrite => c.kind === 'write' && c.path.endsWith('.vscode/settings.json'),
    );
    expect(settingsChange).toBeDefined();
    expect(settingsChange!.proposedContent).not.toContain('dprint.experimentalLsp');
    expect(settingsChange!.proposedContent).not.toContain('dprint.verbose');
    expect(settingsChange!.proposedContent).not.toContain('eslint.useFlatConfig');
    expect(settingsChange!.proposedContent).not.toContain('eslint.format.enable');
    expect(settingsChange!.proposedContent).toContain('"eslint.enable": false');
    expect(settingsChange!.proposedContent).toContain('"editor.formatOnSaveMode": "file"');
    expect(settingsChange!.proposedContent.indexOf('"editor.formatOnSaveMode"')).toBeLessThan(
      settingsChange!.proposedContent.indexOf('"eslint.enable"'),
    );
  });

  it('skips settings.json when cli package already matches oxc canonical layout', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'oxfmt-preview-settings-cli-'));
    const base = {
      name: '@finografic/cli-pkg',
      version: '0.0.0',
      keywords: ['genx:type:cli'],
      devDependencies: { 'oxfmt': '0.0.0', '@finografic/oxc-config': '0.0.0' },
    };
    await writeFile(resolve(dir, PACKAGE_JSON), `${JSON.stringify(base, null, 2)}\n`, 'utf8');
    await writeFile(resolve(dir, 'oxfmt.config.ts'), getOxfmtConfigCanonicalFileContent(), 'utf8');
    await mkdir(resolve(dir, '.vscode'), { recursive: true });
    const settings = `${JSON.stringify(
      {
        'npm.packageManager': 'pnpm',
        'editor.formatOnSave': true,
        'editor.formatOnSaveMode': 'file',
        'editor.defaultFormatter': 'oxc.oxc-vscode',
        'editor.codeActionsOnSave': {
          'source.fixAll.oxc': 'explicit',
          'source.organizeImports': 'never',
          'source.sortImports': 'explicit',
          'source.addMissingImports': 'explicit',
        },
        'eslint.enable': false,
        'prettier.enable': false,
        'oxc.typeAware': true,
        'oxc.lint.run': 'onSave',
        'typescript.tsdk': 'node_modules/typescript/lib',
        'typescript.preferences.preferTypeOnlyAutoImports': true,
        '[javascript]': { 'editor.defaultFormatter': 'oxc.oxc-vscode' },
        '[typescript]': { 'editor.defaultFormatter': 'oxc.oxc-vscode' },
        '[json]': { 'editor.defaultFormatter': 'oxc.oxc-vscode' },
        '[jsonc]': { 'editor.defaultFormatter': 'oxc.oxc-vscode' },
        '[yaml]': { 'editor.defaultFormatter': 'oxc.oxc-vscode' },
        '[toml]': { 'editor.defaultFormatter': 'oxc.oxc-vscode' },
        '[markdown]': {
          'editor.defaultFormatter': 'oxc.oxc-vscode',
          'editor.formatOnSave': true,
        },
        'markdown.styles': ['node_modules/@finografic/md-lint/styles/markdown-github-light.css'],
      },
      null,
      2,
    )}\n`;
    await writeFile(resolve(dir, '.vscode/settings.json'), settings, 'utf8');

    const preview = await previewOxcConfig({ targetDir: dir });
    const settingsChange = getChangedPreviewChanges(preview.changes).find((c) =>
      c.path.endsWith('.vscode/settings.json'),
    );
    expect(settingsChange).toBeUndefined();
  });
});

describe('oxfmt.preview — converge + detection alignment', () => {
  it('after converging writes, preview reports no remaining drift', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'oxfmt-preview-converge-'));
    const base: PackageJson = {
      name: '@finografic/conv-pkg',
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

    const finalPreview = await previewOxcConfig({ targetDir: dir });
    expect(hasPreviewChanges(finalPreview)).toBe(false);
  });
});

describe('oxfmt.preview — needsInstall', () => {
  it('omits needsInstall when package.json diff does not change dependency fields', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'oxfmt-preview-needsinst-'));
    const base: PackageJson = {
      name: '@finografic/needsinst-a',
      version: '0.0.0',
      devDependencies: { 'oxfmt': '0.0.0', '@finografic/oxc-config': '0.0.0' },
    };
    const canonical = computeCanonicalOxfmtPackageJson(base);
    const scripts = { ...canonical.scripts };
    delete scripts[OXFMT_UPDATE_SCRIPT.key];
    const drifted: PackageJson = { ...canonical, scripts };
    await writeFile(resolve(dir, PACKAGE_JSON), formatPackageJsonString(drifted), 'utf8');
    await writeFile(resolve(dir, 'oxfmt.config.ts'), getOxfmtConfigCanonicalFileContent(), 'utf8');

    const preview = await previewOxcConfig({ targetDir: dir });
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

    const preview = await previewOxcConfig({ targetDir: dir });
    expect(preview.needsInstall).toBe(true);
  });
});
