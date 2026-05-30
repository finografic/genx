import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileExists, jsonLikeTextsEquivalent } from 'utils';
import type { FeaturePreviewResult } from '../../lib/feature-preview/feature-preview.types.js';
import type { FeatureContext } from '../feature.types';

import { inferPackageTypeId, isFrontendPackageType } from 'lib/package-type.utils';

import type { PackageJson } from 'types/package-json.types';

import { createWritePreviewChange } from '../../lib/feature-preview/feature-preview.utils.js';
import { OXFMT_CONFIG_FILENAME } from './css.constants';
import { ensureCssImportInOxfmtConfig, insertCssOverrideInOxfmtConfig } from './css.oxfmt';
import { proposeCssCombinedSettingsText, proposeCssExtensionsJsonText } from './css.vscode';

/**
 * Preview CSS feature: ensure oxfmt CSS override and VS Code settings.
 */
export async function previewCss(context: FeatureContext): Promise<FeaturePreviewResult> {
  const { targetDir } = context;
  const packageJsonPath = resolve(targetDir, 'package.json');
  if (fileExists(packageJsonPath)) {
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as PackageJson;
    if (!isFrontendPackageType(inferPackageTypeId(packageJson))) {
      return {
        changes: [],
        applied: ['css feature not applicable for this package type'],
        noopMessage: 'CSS formatting feature is only applicable to frontend package types.',
      };
    }
  }

  const changes: FeaturePreviewResult['changes'] = [];
  const applied: string[] = [];

  const settingsPath = resolve(targetDir, '.vscode', 'settings.json');
  const settingsCurrent = fileExists(settingsPath) ? await readFile(settingsPath, 'utf8') : '{}\n';
  const combined = proposeCssCombinedSettingsText(settingsCurrent);
  if (combined.text !== settingsCurrent) {
    const out = combined.text.endsWith('\n') ? combined.text : `${combined.text}\n`;
    changes.push(
      createWritePreviewChange(settingsPath, settingsCurrent, out, '.vscode/settings.json (oxfmt CSS)'),
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
      const out = next.endsWith('\n') ? next : `${next}\n`;
      changes.push(createWritePreviewChange(oxfmtConfigPath, raw, out, 'oxfmt.config.ts (css override)'));
    } else {
      applied.push('oxfmt.config.ts (css)');
    }
  }

  const extPath = resolve(targetDir, '.vscode', 'extensions.json');
  const extCurrentRaw = fileExists(extPath) ? await readFile(extPath, 'utf8') : undefined;
  const extPreview = proposeCssExtensionsJsonText(extCurrentRaw);
  if (!jsonLikeTextsEquivalent(extPreview.proposed, extCurrentRaw ?? BASE_EXTENSIONS_JSON)) {
    changes.push(
      createWritePreviewChange(extPath, extCurrentRaw ?? '', extPreview.proposed, '.vscode/extensions.json'),
    );
  } else {
    applied.push('.vscode/extensions.json');
  }

  const noopMessage =
    changes.length === 0 ? 'CSS config already canonical (oxfmt CSS formatting).' : undefined;

  return {
    changes,
    applied,
    noopMessage,
  };
}

const BASE_EXTENSIONS_JSON = `${JSON.stringify({ recommendations: [] }, null, 2)}\n`;
