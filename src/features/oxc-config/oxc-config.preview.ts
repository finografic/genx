import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { fileExists, jsonLikeTextsEquivalent, parseJsoncObject, readExtensionsJson } from 'utils';
import type {
  FeaturePreviewChange,
  FeaturePreviewChangeWrite,
  FeaturePreviewResult,
} from '../../lib/feature-preview/feature-preview.types.js';
import type { FeatureContext } from '../feature.types';

import { inferPackageTypeId, isFrontendPackageType } from 'lib/package-type.utils';
import { findPackageRoot } from 'utils/package-root.utils';
import { renderGroupedVSCodeSettingsJson } from 'utils/vscode-settings.render.js';

import {
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
import { getAssociatedLegacyRootFiles } from '../../lib/legacy-removal.utils.js';
import {
  OXC_VSCODE_BASE_LANGUAGES,
  OXC_VSCODE_FRONTEND_LANGUAGES,
  OXFMT_CI_STEP,
  OXFMT_FORMATTER_ID,
  OXFMT_VSCODE_EXTENSIONS,
  PRETTIER_CONFIG_FILES,
} from './oxc-config.constants.js';
import { computeCanonicalOxfmtPackageJson } from './oxc-config.preview.canonical-package-json.js';
import { getOxfmtConfigCanonicalFileContent } from './oxc-config.template.js';

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
  const keys = Object.keys(record).toSorted();
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
  let s = current;
  // Replace bare `pnpm lint` with `pnpm lint:ci` (not followed by : or a word char)
  s = s.replace(/run: pnpm lint(?![:\w])/g, 'run: pnpm lint:ci');
  // Append format:check step if not already present
  if (!s.includes('format:check')) {
    s = `${s.trimEnd()}${OXFMT_CI_STEP}`;
  }
  return s;
}

async function computeCanonicalExtensionsFileContent(targetDir: string): Promise<string> {
  const content = await readExtensionsJson(targetDir);
  const recommendations = [...(content.recommendations ?? [])];
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

async function computeCanonicalSettingsFileContent(
  targetDir: string,
  packageJson: PackageJson,
): Promise<string> {
  const fromDir = fileURLToPath(new URL('.', import.meta.url));
  const pkgRoot = findPackageRoot(fromDir);
  const templatePath = resolve(pkgRoot, '_templates/.vscode/settings.json');
  const templateSettings = parseJsoncObject(await readFile(templatePath, 'utf8'));

  const filePath = resolve(targetDir, VSCODE_DIR, VSCODE_SETTINGS_JSON);
  const existingRaw = fileExists(filePath) ? await readFile(filePath, 'utf8') : '';
  const existing = existingRaw ? parseJsoncObject(existingRaw) : null;

  const packageTypeId = inferPackageTypeId(packageJson);
  const languages = [
    ...OXC_VSCODE_BASE_LANGUAGES,
    ...(isFrontendPackageType(packageTypeId) ? OXC_VSCODE_FRONTEND_LANGUAGES : []),
  ];

  const settings: Record<string, unknown> = existing ? { ...existing } : { ...templateSettings };

  for (const key of OXC_SETTINGS_ROOT_KEYS) {
    if (!(key in templateSettings)) {
      continue;
    }
    if (!(key in settings) || !isDeepStrictEqual(settings[key], templateSettings[key])) {
      settings[key] = templateSettings[key];
    }
  }

  for (const lang of languages) {
    const blockKey = `[${lang}]`;
    const existingBlock = settings[blockKey];
    const baseBlock =
      existingBlock && typeof existingBlock === 'object' && !Array.isArray(existingBlock)
        ? { ...existingBlock }
        : {};

    settings[blockKey] =
      lang === 'markdown'
        ? {
            ...baseBlock,
            'editor.defaultFormatter': OXFMT_FORMATTER_ID,
            'editor.formatOnSave': true,
          }
        : {
            ...baseBlock,
            'editor.defaultFormatter': OXFMT_FORMATTER_ID,
          };
  }

  const proposed = renderGroupedVSCodeSettingsJson(settings, {
    languageOrder: languages,
    pruneExactKeys: ['eslint.format.enable', 'eslint.useFlatConfig'],
    prunePrefixes: ['dprint.'],
  });
  if (existingRaw && jsonLikeTextsEquivalent(existingRaw, proposed)) {
    return existingRaw;
  }
  return proposed;
}

/** Root keys synced from `_templates/.vscode/settings.json` when missing or drifted. */
const OXC_SETTINGS_ROOT_KEYS = [
  'npm.packageManager',
  'editor.formatOnSave',
  'editor.formatOnSaveMode',
  'editor.defaultFormatter',
  'editor.codeActionsOnSave',
  'eslint.enable',
  'prettier.enable',
  'oxc.typeAware',
  'oxc.lint.run',
  'typescript.tsdk',
  'typescript.preferences.preferTypeOnlyAutoImports',
] as const;

const OXFMT_CONFIG_FILENAME = 'oxfmt.config.ts';
const OXLINT_CONFIG_FILENAME = 'oxlint.config.ts';

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
        'package.json (oxfmt, Prettier cleanup, scripts, lint-staged)',
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

  // oxlint.config.ts — copy from _templates/ if missing
  const oxlintConfigPath = resolve(targetDir, OXLINT_CONFIG_FILENAME);
  if (!fileExists(oxlintConfigPath)) {
    const fromDir = fileURLToPath(new URL('.', import.meta.url));
    const pkgRoot = findPackageRoot(fromDir);
    const templatePath = resolve(pkgRoot, '_templates', OXLINT_CONFIG_FILENAME);
    if (fileExists(templatePath)) {
      const templateContent = await readFile(templatePath, 'utf8');
      changes.push(createWritePreviewChange(oxlintConfigPath, '', templateContent, OXLINT_CONFIG_FILENAME));
    }
  } else {
    applied.push(OXLINT_CONFIG_FILENAME);
  }

  for (const file of PRETTIER_CONFIG_FILES) {
    const abs = resolve(targetDir, file);
    if (!fileExists(abs)) continue;
    const body = await readFile(abs, 'utf8');
    changes.push(createDeletePreviewChange(abs, body, true, `remove Prettier config (${file})`));
  }

  for (const file of getAssociatedLegacyRootFiles('oxc-config')) {
    const abs = resolve(targetDir, file);
    if (!fileExists(abs)) continue;
    const body = await readFile(abs, 'utf8');
    changes.push(createDeletePreviewChange(abs, body, true, `remove legacy config (${file})`));
  }

  const ciAbs = resolve(targetDir, CI_WORKFLOW_REL);
  if (fileExists(ciAbs)) {
    const raw = await readFile(ciAbs, 'utf8');
    const proposed = proposeCiYmlContent(raw);
    if (proposed !== raw) {
      changes.push(
        createWritePreviewChange(ciAbs, raw, proposed, '.github/workflows/ci.yml (lint:ci + format check)'),
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
  if (!jsonLikeTextsEquivalent(proposedExt, currentExt)) {
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
  const proposedSettings = await computeCanonicalSettingsFileContent(targetDir, currentPkg);
  if (!jsonLikeTextsEquivalent(proposedSettings, currentSettings)) {
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
