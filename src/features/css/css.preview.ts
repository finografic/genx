import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sortedRecord } from '@finografic/cli-kit/package-manager';
import { fileExists } from 'utils';
import type { FeaturePreviewResult } from '../../lib/feature-preview/feature-preview.types.js';
import type { FeatureContext } from '../feature.types';

import { PACKAGE_JSON } from 'config/constants.config';
import type { PackageJson } from 'types/package-json.types';

import {
  createDeletePreviewChange,
  createWritePreviewChange,
} from '../../lib/feature-preview/feature-preview.utils.js';
import { packageJsonManifestDependencyFieldsChanged } from '../oxc-config/oxc-config.preview.js';
import {
  LEGACY_STYLELINTRC_FILENAME,
  OXFMT_CONFIG_FILENAME,
  STYLELINT_CONFIG_FILENAME,
  STYLELINT_PACKAGE,
  STYLELINT_STYLISTIC_PACKAGE,
} from './css.constants';
import { ensureCssImportInOxfmtConfig, insertCssOverrideInOxfmtConfig } from './css.oxfmt';
import { proposeCssCombinedSettingsText, proposeCssExtensionsJsonText } from './css.vscode';

function formatPackageJsonString(packageJson: PackageJson): string {
  return `${JSON.stringify(packageJson, null, 2)}\n`;
}

// DEPRECATED: stylelint removed in favour of oxfmt CSS support. Kept for removal detection.
function withoutStylelintDependencies(packageJson: PackageJson): PackageJson {
  const devDeps = { ...(packageJson.devDependencies as Record<string, string> | undefined) };
  const deps = { ...(packageJson.dependencies as Record<string, string> | undefined) };
  let changed = false;

  for (const pkg of [STYLELINT_PACKAGE, STYLELINT_STYLISTIC_PACKAGE]) {
    if (devDeps[pkg] !== undefined) {
      delete devDeps[pkg];
      changed = true;
    }
    if (deps[pkg] !== undefined) {
      delete deps[pkg];
      changed = true;
    }
  }

  if (!changed) return packageJson;
  return {
    ...packageJson,
    devDependencies: sortedRecord(devDeps),
    dependencies: sortedRecord(deps),
  };
}

/**
 * Preview CSS feature: remove legacy stylelint, ensure oxfmt CSS override and VS Code settings.
 */
export async function previewCss(context: FeatureContext): Promise<FeaturePreviewResult> {
  const { targetDir } = context;
  const changes: FeaturePreviewResult['changes'] = [];
  const applied: string[] = [];

  // DEPRECATED: remove stylelint / @stylistic/stylelint-plugin from package.json
  const packageJsonPath = resolve(targetDir, PACKAGE_JSON);
  const rawPkg = await readFile(packageJsonPath, 'utf8');
  const pkg = withoutStylelintDependencies(JSON.parse(rawPkg) as PackageJson);
  const proposedPkgRaw = formatPackageJsonString(pkg);
  if (proposedPkgRaw !== rawPkg) {
    changes.push(
      createWritePreviewChange(
        packageJsonPath,
        rawPkg,
        proposedPkgRaw,
        'package.json (remove legacy stylelint)',
      ),
    );
  } else {
    applied.push('package.json (no legacy stylelint)');
  }

  // DEPRECATED: stylelint.config.ts removed in favour of oxfmt CSS formatting.
  const stylelintConfigPath = resolve(targetDir, STYLELINT_CONFIG_FILENAME);
  if (fileExists(stylelintConfigPath)) {
    const body = await readFile(stylelintConfigPath, 'utf8');
    changes.push(
      createDeletePreviewChange(
        stylelintConfigPath,
        body,
        true,
        `remove ${STYLELINT_CONFIG_FILENAME} (replaced by oxfmt)`,
      ),
    );
  } else {
    applied.push(`${STYLELINT_CONFIG_FILENAME} (not present)`);
  }

  const legacyStylelintPath = resolve(targetDir, LEGACY_STYLELINTRC_FILENAME);
  if (fileExists(legacyStylelintPath)) {
    const legacyBody = await readFile(legacyStylelintPath, 'utf8');
    changes.push(
      createDeletePreviewChange(
        legacyStylelintPath,
        legacyBody,
        true,
        `${LEGACY_STYLELINTRC_FILENAME} (removed)`,
      ),
    );
  }

  const settingsPath = resolve(targetDir, '.vscode', 'settings.json');
  const settingsCurrent = fileExists(settingsPath) ? await readFile(settingsPath, 'utf8') : '{}\n';
  const combined = proposeCssCombinedSettingsText(settingsCurrent);
  if (combined.text !== settingsCurrent) {
    const out = combined.text.endsWith('\n') ? combined.text : `${combined.text}\n`;
    changes.push(
      createWritePreviewChange(
        settingsPath,
        settingsCurrent,
        out,
        '.vscode/settings.json (oxfmt CSS + remove stylelint)',
      ),
    );
  } else {
    applied.push('.vscode/settings.json (css)');
  }

  const oxfmtConfigPath = resolve(targetDir, OXFMT_CONFIG_FILENAME);
  if (fileExists(oxfmtConfigPath)) {
    const raw = await readFile(oxfmtConfigPath, 'utf8');
    const normalized = raw.replace(/\r\n/g, '\n');
    let next = ensureCssImportInOxfmtConfig(normalized);
    next = insertCssOverrideInOxfmtConfig(next);
    if (next !== normalized) {
      const out = `${next.endsWith('\n') ? next : `${next}\n`}`;
      changes.push(createWritePreviewChange(oxfmtConfigPath, raw, out, 'oxfmt.config.ts (css override)'));
    } else {
      applied.push('oxfmt.config.ts (css)');
    }
  }

  const extPath = resolve(targetDir, '.vscode', 'extensions.json');
  const extCurrentRaw = fileExists(extPath) ? await readFile(extPath, 'utf8') : undefined;
  const extPreview = proposeCssExtensionsJsonText(extCurrentRaw);
  // Detect a change: proposed !== current (including stylelint removal from recommendations)
  const extCurrentNormalized = extCurrentRaw
    ? JSON.stringify(JSON.parse(extCurrentRaw), null, 2) + '\n'
    : undefined;
  if (extPreview.proposed !== (extCurrentNormalized ?? BASE_EXTENSIONS_JSON)) {
    changes.push(
      createWritePreviewChange(
        extPath,
        extCurrentRaw ?? '',
        extPreview.proposed,
        '.vscode/extensions.json (oxfmt CSS, remove stylelint)',
      ),
    );
  } else {
    applied.push('.vscode/extensions.json');
  }

  const noopMessage =
    changes.length === 0
      ? 'CSS config already canonical (oxfmt CSS formatting, no legacy stylelint).'
      : undefined;

  const pkgWrite = changes.find((c) => c.kind === 'write' && c.path === packageJsonPath);
  const needsInstall =
    pkgWrite !== undefined &&
    pkgWrite.kind === 'write' &&
    packageJsonManifestDependencyFieldsChanged(pkgWrite.currentContent, pkgWrite.proposedContent);

  return {
    changes,
    applied,
    noopMessage,
    ...(needsInstall ? { needsInstall: true as const } : {}),
  };
}

const BASE_EXTENSIONS_JSON = `${JSON.stringify({ recommendations: [] }, null, 2)}\n`;
