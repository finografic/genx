import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fileExists, isDependencyDeclared, sortedRecord } from 'utils';
import type { FeaturePreviewResult } from '../../lib/feature-preview/feature-preview.types.js';
import type { FeatureContext } from '../feature.types';

import { findPackageRoot } from 'utils/package-root.utils';
import {
  PACKAGE_JSON,
  PACKAGE_JSON_SCRIPTS_SECTION_DIVIDER,
  PACKAGE_JSON_SCRIPTS_SECTION_PREFIX,
} from 'config/constants.config';
import type { PackageJson } from 'types/package-json.types';
import { createWritePreviewChange } from '../../lib/feature-preview/feature-preview.utils.js';
import { packageJsonManifestDependencyFieldsChanged } from '../oxfmt/oxfmt.preview.js';
import {
  TEST_SCRIPTS,
  TESTING_SECTION_TITLE,
  VITEST_PACKAGE,
  VITEST_PACKAGE_VERSION,
} from './vitest.constants';

function formatPackageJsonString(packageJson: PackageJson): string {
  return `${JSON.stringify(packageJson, null, 2)}\n`;
}

function hasTestingScripts(scripts: Record<string, string>): boolean {
  return 'test' in scripts || 'test:run' in scripts || 'test:coverage' in scripts;
}

function hasTestingSectionTitle(scripts: Record<string, string>): boolean {
  return Object.keys(scripts).some((key) => key === TESTING_SECTION_TITLE);
}

function findTestingInsertionPoint(scripts: Record<string, string>): number {
  if (hasTestingScripts(scripts)) {
    return -1;
  }

  const scriptKeys = Object.keys(scripts);
  const buildIndex = scriptKeys.findIndex((key) => key.includes('BUILD'));
  if (buildIndex !== -1) {
    let insertAfter = buildIndex;
    for (let i = buildIndex + 1; i < scriptKeys.length; i++) {
      const key = scriptKeys[i];
      if (key.startsWith(PACKAGE_JSON_SCRIPTS_SECTION_PREFIX)) {
        break;
      }
      insertAfter = i;
    }
    return insertAfter + 1;
  }

  return scriptKeys.length;
}

function withTestingScripts(packageJson: PackageJson): PackageJson {
  const scripts = { ...packageJson.scripts };

  if (hasTestingScripts(scripts)) {
    return packageJson;
  }

  const scriptKeys = Object.keys(scripts);
  const insertionPoint = findTestingInsertionPoint(scripts);

  if (insertionPoint === -1) {
    return packageJson;
  }

  const newScripts: Record<string, string> = {};

  for (let i = 0; i < insertionPoint; i++) {
    const key = scriptKeys[i];
    newScripts[key] = scripts[key];
  }

  if (!hasTestingSectionTitle(scripts)) {
    newScripts[TESTING_SECTION_TITLE] = PACKAGE_JSON_SCRIPTS_SECTION_DIVIDER;
  }

  for (const [scriptKey, scriptValue] of Object.entries(TEST_SCRIPTS)) {
    newScripts[scriptKey] = scriptValue;
  }

  for (let i = insertionPoint; i < scriptKeys.length; i++) {
    const key = scriptKeys[i];
    newScripts[key] = scripts[key];
  }

  return { ...packageJson, scripts: newScripts };
}

function withVitestDependency(packageJson: PackageJson): PackageJson {
  const devDeps = packageJson.devDependencies as Record<string, string> | undefined;
  if (devDeps?.[VITEST_PACKAGE]) {
    return packageJson;
  }
  const devDependencies = sortedRecord({
    ...((packageJson.devDependencies as Record<string, string> | undefined) ?? {}),
    [VITEST_PACKAGE]: VITEST_PACKAGE_VERSION,
  });
  return { ...packageJson, devDependencies };
}

/**
 * Preview vitest.config.ts + package.json scripts and vitest devDependency.
 */
export async function previewVitest(context: FeatureContext): Promise<FeaturePreviewResult> {
  const { targetDir } = context;
  const changes: FeaturePreviewResult['changes'] = [];
  const applied: string[] = [];

  const packageJsonPath = resolve(targetDir, PACKAGE_JSON);
  const rawPkg = await readFile(packageJsonPath, 'utf8');
  let pkg = JSON.parse(rawPkg) as PackageJson;

  const hadDep = await isDependencyDeclared(targetDir, VITEST_PACKAGE);
  if (!hadDep) {
    pkg = withVitestDependency(pkg);
  }
  pkg = withTestingScripts(pkg);

  const proposedPkgRaw = formatPackageJsonString(pkg);
  if (proposedPkgRaw !== rawPkg) {
    changes.push(
      createWritePreviewChange(
        packageJsonPath,
        rawPkg,
        proposedPkgRaw,
        'package.json (vitest, test scripts)',
      ),
    );
  } else {
    applied.push('package.json (vitest manifest)');
  }

  const vitestConfigPath = resolve(targetDir, 'vitest.config.ts');
  if (!fileExists(vitestConfigPath)) {
    const fromDir = fileURLToPath(new URL('.', import.meta.url));
    const packageRoot = findPackageRoot(fromDir);
    const templateVitestConfigPath = resolve(packageRoot, '_templates/vitest.config.ts');
    if (!fileExists(templateVitestConfigPath)) {
      throw new Error('Template vitest.config.ts not found');
    }
    const templateContent = await readFile(templateVitestConfigPath, 'utf8');
    changes.push(createWritePreviewChange(vitestConfigPath, '', templateContent, 'vitest.config.ts'));
  } else {
    applied.push('vitest.config.ts');
  }

  const noopMessage = changes.length === 0 ? 'Vitest already matches canonical test setup.' : undefined;

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
