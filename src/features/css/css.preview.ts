import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileExists, isDependencyDeclared, sortedRecord } from 'utils';
import type { FeaturePreviewResult } from '../../lib/feature-preview/feature-preview.types.js';
import type { FeatureContext } from '../feature.types';

import { PACKAGE_JSON } from 'config/constants.config';
import type { PackageJson } from 'types/package-json.types';
import {
  createDeletePreviewChange,
  createWritePreviewChange,
} from '../../lib/feature-preview/feature-preview.utils.js';
import { packageJsonManifestDependencyFieldsChanged } from '../oxfmt/oxfmt.preview.js';
import {
  LEGACY_STYLELINTRC_FILENAME,
  OXFMT_CONFIG_FILENAME,
  STYLELINT_CONFIG_FILENAME,
  STYLELINT_CONFIG_TS_CONTENT,
  STYLELINT_PACKAGE,
  STYLELINT_PACKAGE_VERSION,
  STYLELINT_STYLISTIC_PACKAGE,
  STYLELINT_STYLISTIC_PACKAGE_VERSION,
} from './css.constants';
import { ensureCssImportInOxfmtConfig, insertCssOverrideInOxfmtConfig } from './css.oxfmt';
import { proposeCssCombinedSettingsText, proposeCssExtensionsJsonText } from './css.vscode';

function formatPackageJsonString(packageJson: PackageJson): string {
  return `${JSON.stringify(packageJson, null, 2)}\n`;
}

async function withCssDevDependencies(targetDir: string, packageJson: PackageJson): Promise<PackageJson> {
  let next = packageJson;
  const additions: Record<string, string> = {};
  if (!(await isDependencyDeclared(targetDir, STYLELINT_PACKAGE))) {
    additions[STYLELINT_PACKAGE] = STYLELINT_PACKAGE_VERSION;
  }
  if (!(await isDependencyDeclared(targetDir, STYLELINT_STYLISTIC_PACKAGE))) {
    additions[STYLELINT_STYLISTIC_PACKAGE] = STYLELINT_STYLISTIC_PACKAGE_VERSION;
  }
  if (Object.keys(additions).length > 0) {
    next = {
      ...next,
      devDependencies: sortedRecord({
        ...((next.devDependencies as Record<string, string> | undefined) ?? {}),
        ...additions,
      }),
    };
  }
  return next;
}

/**
 * Preview CSS feature: package.json deps, stylelint config, VS Code, oxfmt patch, extensions.
 */
export async function previewCss(context: FeatureContext): Promise<FeaturePreviewResult> {
  const { targetDir } = context;
  const changes: FeaturePreviewResult['changes'] = [];
  const applied: string[] = [];

  const packageJsonPath = resolve(targetDir, PACKAGE_JSON);
  const rawPkg = await readFile(packageJsonPath, 'utf8');
  let pkg = JSON.parse(rawPkg) as PackageJson;
  pkg = await withCssDevDependencies(targetDir, pkg);
  const proposedPkgRaw = formatPackageJsonString(pkg);
  if (proposedPkgRaw !== rawPkg) {
    changes.push(
      createWritePreviewChange(packageJsonPath, rawPkg, proposedPkgRaw, 'package.json (stylelint deps)'),
    );
  } else {
    applied.push('package.json (stylelint deps)');
  }

  const stylelintConfigPath = resolve(targetDir, STYLELINT_CONFIG_FILENAME);
  if (!fileExists(stylelintConfigPath)) {
    changes.push(
      createWritePreviewChange(
        stylelintConfigPath,
        '',
        STYLELINT_CONFIG_TS_CONTENT,
        STYLELINT_CONFIG_FILENAME,
      ),
    );
  } else {
    applied.push(STYLELINT_CONFIG_FILENAME);
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
        '.vscode/settings.json (stylelint + oxfmt)',
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
  if (extPreview.added.length > 0) {
    changes.push(
      createWritePreviewChange(
        extPath,
        extCurrentRaw ?? '',
        extPreview.proposed,
        '.vscode/extensions.json (stylelint)',
      ),
    );
  } else {
    applied.push('.vscode/extensions.json');
  }

  const noopMessage =
    changes.length === 0 ? 'CSS linting already matches canonical configuration for owned files.' : undefined;

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
