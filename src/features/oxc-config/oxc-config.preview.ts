import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileExists, parseJsoncObject, readExtensionsJson } from 'utils';
import type {
  FeaturePreviewChange,
  FeaturePreviewChangeWrite,
  FeaturePreviewResult,
} from '../../lib/feature-preview/feature-preview.types.js';
import type { FeatureContext } from '../feature.types';

import { VSCODE_MARKDOWN_TAIL_KEYS } from 'utils/vscode-jsonc.utils.js';

import {
  ESLINT_CONFIG_FILES,
  PACKAGE_JSON,
  VSCODE_DIR,
  VSCODE_EXTENSIONS_JSON,
  VSCODE_SETTINGS_JSON,
} from 'config/constants.config';
import type { PackageJson } from 'types/package-json.types';

import {
  createDeletePreviewChange,
  createWritePreviewChange,
} from '../../lib/feature-preview/feature-preview.utils.js';
import {
  CANONICAL_VSCODE_LANGUAGES,
  DPRINT_CONFIG_FILES,
  LEGACY_VSCODE_EXTENSIONS_TO_REMOVE,
  OXFMT_CI_STEP,
  OXFMT_FORMATTER_ID,
  OXFMT_VSCODE_EXTENSIONS,
  PRETTIER_CONFIG_FILES,
  STYLELINT_CONFIG_FILES,
} from './oxc-config.constants.js';
import { computeCanonicalOxfmtPackageJson } from './oxc-config.preview.canonical-package-json.js';
import { getOxfmtConfigCanonicalFileContent } from './oxc-config.template.js';
import { OXFMT_GITHUB_WORKFLOW_PATHS, scrubDprintFromWorkflowContent } from './oxc-config.workflows.js';

export { computeCanonicalOxfmtPackageJson } from './oxc-config.preview.canonical-package-json.js';

const CI_WORKFLOW_REL = '.github/workflows/ci.yml';

function isEnoent(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: string }).code === 'ENOENT'
  );
}

function formatPackageJsonString(packageJson: PackageJson): string {
  return `${JSON.stringify(packageJson, null, 2)}\n`;
}

function stableDependencyJsonSlice(deps: unknown): string {
  if (!deps || typeof deps !== 'object') {
    return '{}';
  }
  const record = deps as Record<string, string>;
  const keys = Object.keys(record).sort();
  const sorted: Record<string, string> = {};
  for (const k of keys) {
    sorted[k] = record[k]!;
  }
  return JSON.stringify(sorted);
}

/**
 * True when `dependencies` / `devDependencies` differ — apply may need `pnpm install` after writing
 * package.json.
 */
export function packageJsonManifestDependencyFieldsChanged(currentRaw: string, proposedRaw: string): boolean {
  const cur = JSON.parse(currentRaw) as PackageJson;
  const next = JSON.parse(proposedRaw) as PackageJson;
  return (
    stableDependencyJsonSlice(cur.dependencies) !== stableDependencyJsonSlice(next.dependencies) ||
    stableDependencyJsonSlice(cur.devDependencies) !== stableDependencyJsonSlice(next.devDependencies)
  );
}

function proposeCiYmlContent(current: string): string {
  if (
    current.includes('oxfmt --check') ||
    current.includes('pnpm format:check') ||
    current.includes('format:check')
  ) {
    return current;
  }
  return `${current.trimEnd()}${OXFMT_CI_STEP}`;
}

async function computeCanonicalExtensionsFileContent(targetDir: string): Promise<string> {
  const content = await readExtensionsJson(targetDir);
  const recommendations = [...(content.recommendations ?? [])].filter(
    (id) =>
      !LEGACY_VSCODE_EXTENSIONS_TO_REMOVE.includes(id as (typeof LEGACY_VSCODE_EXTENSIONS_TO_REMOVE)[number]),
  );
  for (const ext of OXFMT_VSCODE_EXTENSIONS) {
    if (!recommendations.includes(ext)) {
      recommendations.push(ext);
    }
  }
  // DEPRECATED: unwantedRecommendations — remove the field if present.
  const { unwantedRecommendations: _removed, ...rest } = content;
  const next = { ...rest, recommendations };
  return `${JSON.stringify(next, null, 2)}\n`;
}

async function computeCanonicalSettingsFileContent(targetDir: string): Promise<string> {
  const filePath = resolve(targetDir, VSCODE_DIR, VSCODE_SETTINGS_JSON);

  // Canonical top block
  const settings: Record<string, unknown> = {
    'npm.packageManager': 'pnpm',
    'editor.formatOnSave': true,
    'editor.formatOnSaveMode': 'file',
    'editor.defaultFormatter': OXFMT_FORMATTER_ID,
    'editor.codeActionsOnSave': { 'source.fixAll.oxc': 'explicit', 'source.organizeImports': 'explicit' },
    'eslint.enable': false,
    'eslint.validate': ['javascript', 'typescript'],
    'prettier.enable': false,
    'oxc.typeAware': true,
    'oxc.lint.run': 'onSave',
    'typescript.tsdk': 'node_modules/typescript/lib',
    'typescript.preferences.preferTypeOnlyAutoImports': true,
  };

  // Canonical language blocks — all unconditional; markdown gets extra formatOnSave
  for (const lang of CANONICAL_VSCODE_LANGUAGES) {
    const block: Record<string, unknown> = { 'editor.defaultFormatter': OXFMT_FORMATTER_ID };
    if (lang === 'markdown') block['editor.formatOnSave'] = true;
    settings[`[${lang}]`] = block;
  }

  // Preserve tail keys (markdownlint.config, markdown.styles) from the existing file
  if (fileExists(filePath)) {
    const existing = parseJsoncObject(await readFile(filePath, 'utf8')) as Record<string, unknown>;
    for (const tailKey of VSCODE_MARKDOWN_TAIL_KEYS) {
      if (tailKey in existing) settings[tailKey] = existing[tailKey];
    }
  }

  return `${JSON.stringify(settings, null, 2)}\n`;
}

const OXFMT_CONFIG_FILENAME = 'oxfmt.config.ts';

/**
 * Preview files and package metadata owned by `applyOxfmt` so detection matches apply breadth.
 */
export async function previewOxcConfig(context: FeatureContext): Promise<FeaturePreviewResult> {
  const { targetDir } = context;
  const packageJsonPath = resolve(targetDir, PACKAGE_JSON);
  const configPath = resolve(targetDir, OXFMT_CONFIG_FILENAME);

  const currentPkgRaw = await readFile(packageJsonPath, 'utf8');
  const currentPkg = JSON.parse(currentPkgRaw) as PackageJson;
  const canonicalPkg = computeCanonicalOxfmtPackageJson(currentPkg);
  const proposedPkgRaw = formatPackageJsonString(canonicalPkg);

  const changes: FeaturePreviewChange[] = [];
  const applied: string[] = [];

  if (proposedPkgRaw !== currentPkgRaw) {
    changes.push(
      createWritePreviewChange(
        packageJsonPath,
        currentPkgRaw,
        proposedPkgRaw,
        'package.json (oxfmt, Prettier/dprint cleanup, scripts, lint-staged)',
      ),
    );
  } else {
    applied.push('package.json (oxfmt canonical layout)');
  }

  const canonicalConfig = getOxfmtConfigCanonicalFileContent();
  let currentConfig = '';
  try {
    currentConfig = await readFile(configPath, 'utf8');
  } catch (error) {
    if (!isEnoent(error)) throw error;
  }

  if (currentConfig !== canonicalConfig) {
    changes.push(createWritePreviewChange(configPath, currentConfig, canonicalConfig, OXFMT_CONFIG_FILENAME));
  } else {
    applied.push(OXFMT_CONFIG_FILENAME);
  }

  for (const file of PRETTIER_CONFIG_FILES) {
    const abs = resolve(targetDir, file);
    if (!fileExists(abs)) continue;
    const body = await readFile(abs, 'utf8');
    changes.push(createDeletePreviewChange(abs, body, true, `remove Prettier config (${file})`));
  }

  for (const file of DPRINT_CONFIG_FILES) {
    const abs = resolve(targetDir, file);
    if (!fileExists(abs)) continue;
    const body = await readFile(abs, 'utf8');
    changes.push(createDeletePreviewChange(abs, body, true, `remove legacy ${file}`));
  }

  for (const file of STYLELINT_CONFIG_FILES) {
    const abs = resolve(targetDir, file);
    if (!fileExists(abs)) continue;
    const body = await readFile(abs, 'utf8');
    changes.push(createDeletePreviewChange(abs, body, true, `remove ${file} (replaced by oxfmt)`));
  }

  const ciAbs = resolve(targetDir, CI_WORKFLOW_REL);

  for (const rel of OXFMT_GITHUB_WORKFLOW_PATHS) {
    const abs = resolve(targetDir, rel);
    if (!fileExists(abs)) continue;
    if (abs === ciAbs) {
      continue;
    }
    const raw = await readFile(abs, 'utf8');
    const { content: scrubbed, changed } = scrubDprintFromWorkflowContent(raw);
    if (changed) {
      changes.push(createWritePreviewChange(abs, raw, scrubbed, `${rel} (dprint → pnpm format:check)`));
    } else {
      applied.push(`${rel} (no dprint drift)`);
    }
  }

  if (fileExists(ciAbs)) {
    const raw = await readFile(ciAbs, 'utf8');
    const { content: afterDprint } = scrubDprintFromWorkflowContent(raw);
    const proposed = proposeCiYmlContent(afterDprint);
    if (proposed !== raw) {
      changes.push(
        createWritePreviewChange(
          ciAbs,
          raw,
          proposed,
          '.github/workflows/ci.yml (dprint scrub + format check)',
        ),
      );
    } else {
      applied.push('ci.yml (no workflow drift)');
    }
  }

  const extPath = resolve(targetDir, VSCODE_DIR, VSCODE_EXTENSIONS_JSON);
  let currentExt = '';
  if (fileExists(extPath)) {
    currentExt = await readFile(extPath, 'utf8');
  }
  const proposedExt = await computeCanonicalExtensionsFileContent(targetDir);
  if (proposedExt !== currentExt) {
    changes.push(
      createWritePreviewChange(
        extPath,
        currentExt,
        proposedExt,
        '.vscode/extensions.json (oxc + Prettier unwanted)',
      ),
    );
  } else {
    applied.push('.vscode/extensions.json');
  }

  const settingsPath = resolve(targetDir, VSCODE_DIR, VSCODE_SETTINGS_JSON);
  let currentSettings = '';
  if (fileExists(settingsPath)) {
    currentSettings = await readFile(settingsPath, 'utf8');
  }
  const proposedSettings = await computeCanonicalSettingsFileContent(targetDir);
  if (proposedSettings !== currentSettings) {
    changes.push(
      createWritePreviewChange(
        settingsPath,
        currentSettings,
        proposedSettings,
        '.vscode/settings.json (oxfmt formatter + editor defaults)',
      ),
    );
  } else {
    applied.push('.vscode/settings.json');
  }

  // DEPRECATED: eslint.config.* files removed — oxlint replaces ESLint.
  for (const name of ESLINT_CONFIG_FILES) {
    const abs = resolve(targetDir, name);
    if (!fileExists(abs)) continue;
    const raw = await readFile(abs, 'utf8');
    changes.push(createDeletePreviewChange(abs, raw, true, `remove ${name} (replaced by oxlint)`));
  }

  const noopMessage =
    changes.length === 0
      ? 'oxc-config already matches canonical configuration across owned files (package.json, config, workflows, VS Code).'
      : undefined;

  const pkgWrite = changes.find(
    (c): c is FeaturePreviewChangeWrite => c.kind === 'write' && c.path === packageJsonPath,
  );
  const needsInstall =
    pkgWrite !== undefined &&
    packageJsonManifestDependencyFieldsChanged(pkgWrite.currentContent, pkgWrite.proposedContent);

  return {
    changes,
    applied,
    noopMessage,
    ...(needsInstall ? { needsInstall: true as const } : {}),
  };
}
