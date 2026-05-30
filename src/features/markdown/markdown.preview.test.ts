import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { FeaturePreviewChangeWrite } from '../../lib/feature-preview/feature-preview.types.js';

import { PACKAGE_JSON } from 'config/constants.config';
import type { PackageJson } from 'types/package-json.types';

import { getChangedPreviewChanges } from '../../lib/feature-preview/feature-preview.utils.js';
import {
  MARKDOWNLINT_CONFIG_EXTENDS_VALUE,
  MARKDOWNLINT_CONFIG_FILE,
  MARKDOWNLINT_CONFIG_FILE_TEXT,
} from './markdown.constants.js';
import { previewMarkdown } from './markdown.preview.js';

function formatPackageJsonString(packageJson: PackageJson): string {
  return `${JSON.stringify(packageJson, null, 2)}\n`;
}

describe('markdown.preview', () => {
  it('removes deprecated inline markdownlint.config from .vscode/settings.json', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'markdown-preview-settings-'));
    await writeFile(
      resolve(dir, PACKAGE_JSON),
      formatPackageJsonString({ name: '@finografic/md-preview', version: '0.0.0' }),
      'utf8',
    );
    await mkdir(resolve(dir, '.vscode'), { recursive: true });
    await writeFile(
      resolve(dir, '.vscode/settings.json'),
      `{
  "markdownlint.config": {
    "default": true
  },
  "markdown.styles": ["node_modules/@finografic/md-lint/styles/markdown-github-light.css"]
}
`,
      'utf8',
    );

    const preview = await previewMarkdown({ targetDir: dir });
    const settingsChange = getChangedPreviewChanges(preview.changes).find(
      (change): change is FeaturePreviewChangeWrite =>
        change.kind === 'write' && change.path.endsWith('.vscode/settings.json'),
    );

    expect(settingsChange).toBeDefined();
    expect(settingsChange?.proposedContent).not.toContain('"markdownlint.config"');
    expect(settingsChange?.proposedContent).toContain('"markdown.styles"');
  });

  it('creates .markdownlint.jsonc when missing', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'markdown-preview-config-'));
    await writeFile(
      resolve(dir, PACKAGE_JSON),
      formatPackageJsonString({ name: '@finografic/md-preview', version: '0.0.0' }),
      'utf8',
    );

    const preview = await previewMarkdown({ targetDir: dir });
    const configChange = getChangedPreviewChanges(preview.changes).find(
      (change): change is FeaturePreviewChangeWrite =>
        change.kind === 'write' && change.path.endsWith(MARKDOWNLINT_CONFIG_FILE),
    );

    expect(configChange).toBeDefined();
    expect(configChange?.proposedContent).toBe(MARKDOWNLINT_CONFIG_FILE_TEXT);
  });

  it('does not rewrite .markdownlint.jsonc when extends already points at md-lint config', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'markdown-preview-config-ok-'));
    await writeFile(
      resolve(dir, PACKAGE_JSON),
      formatPackageJsonString({ name: '@finografic/md-preview', version: '0.0.0' }),
      'utf8',
    );
    await writeFile(
      resolve(dir, MARKDOWNLINT_CONFIG_FILE),
      `{
  "extends": "${MARKDOWNLINT_CONFIG_EXTENDS_VALUE}",
  "MD013": false
}
`,
      'utf8',
    );

    const preview = await previewMarkdown({ targetDir: dir });
    const configChange = getChangedPreviewChanges(preview.changes).find((change) =>
      change.path.endsWith(MARKDOWNLINT_CONFIG_FILE),
    );

    expect(configChange).toBeUndefined();
  });
});
