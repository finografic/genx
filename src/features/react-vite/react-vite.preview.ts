import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sortedRecord } from '@finografic/cli-kit/package-manager';
import { fileExists, isDependencyDeclared } from 'utils';
import type { FeaturePreviewResult } from '../../lib/feature-preview/feature-preview.types.js';
import type { FeatureContext } from '../feature.types';

import { findPackageRoot } from 'utils/package-root.utils';

import { PACKAGE_JSON } from 'config/constants.config';
import type { PackageJson } from 'types/package-json.types';

import { createWritePreviewChange } from '../../lib/feature-preview/feature-preview.utils.js';
import { packageJsonManifestDependencyFieldsChanged } from '../oxc-config/oxc-config.preview.js';
import {
  APP_TSX_FILE,
  MAIN_TSX_FILE,
  PANDA_CONFIG_FILE,
  POSTCSS_CONFIG_FILE,
  REACT_DEV_DEPS,
  REACT_RUNTIME_DEPS,
  REACT_VITE_CONFIG_FILE,
  VITE_ENV_DTS_FILE,
} from './react-vite.constants';

function formatPackageJsonString(packageJson: PackageJson): string {
  return `${JSON.stringify(packageJson, null, 2)}\n`;
}

function withReactDependencies(packageJson: PackageJson): PackageJson {
  let changed = false;
  const deps = { ...packageJson.dependencies };
  const devDeps = { ...packageJson.devDependencies };

  for (const [pkg, version] of Object.entries(REACT_RUNTIME_DEPS)) {
    if (!deps[pkg]) {
      deps[pkg] = version;
      changed = true;
    }
  }

  for (const [pkg, version] of Object.entries(REACT_DEV_DEPS)) {
    if (!devDeps[pkg]) {
      devDeps[pkg] = version;
      changed = true;
    }
  }

  if (!changed) return packageJson;

  return {
    ...packageJson,
    dependencies: sortedRecord(deps),
    devDependencies: sortedRecord(devDeps),
  };
}

async function readTemplateFile(relativePath: string): Promise<string> {
  const fromDir = fileURLToPath(new URL('.', import.meta.url));
  const packageRoot = findPackageRoot(fromDir);
  const templatePath = resolve(packageRoot, '_templates/package-types/react', relativePath);
  if (!fileExists(templatePath)) {
    throw new Error(`Template file not found: ${templatePath}`);
  }
  return readFile(templatePath, 'utf8');
}

/**
 * Preview React + Vite config files and dependencies.
 */
export async function previewReactVite(context: FeatureContext): Promise<FeaturePreviewResult> {
  const { targetDir } = context;
  const changes: FeaturePreviewResult['changes'] = [];
  const applied: string[] = [];

  // 1. Check package.json dependencies
  const packageJsonPath = resolve(targetDir, PACKAGE_JSON);
  const rawPkg = await readFile(packageJsonPath, 'utf8');
  let pkg = JSON.parse(rawPkg) as PackageJson;

  const hasPrimaryDep = await isDependencyDeclared(targetDir, 'react');
  if (!hasPrimaryDep) {
    pkg = withReactDependencies(pkg);
  }

  const proposedPkgRaw = formatPackageJsonString(pkg);
  if (proposedPkgRaw !== rawPkg) {
    changes.push(
      createWritePreviewChange(packageJsonPath, rawPkg, proposedPkgRaw, 'package.json (react dependencies)'),
    );
  } else {
    applied.push('package.json (react dependencies)');
  }

  // 2. Check config files — propose template content when missing
  const configFiles = [
    { file: REACT_VITE_CONFIG_FILE, label: 'vite.config.ts' },
    { file: PANDA_CONFIG_FILE, label: 'panda.config.ts' },
    { file: POSTCSS_CONFIG_FILE, label: 'postcss.config.mjs' },
    { file: VITE_ENV_DTS_FILE, label: 'src/vite-env.d.ts' },
  ];

  for (const { file, label } of configFiles) {
    const filePath = resolve(targetDir, file);
    if (!fileExists(filePath)) {
      const templateContent = await readTemplateFile(file);
      changes.push(createWritePreviewChange(filePath, '', templateContent, label));
    } else {
      applied.push(label);
    }
  }

  // 3. Check entry point files
  const entryFiles = [
    { file: MAIN_TSX_FILE, label: 'src/main.tsx' },
    { file: APP_TSX_FILE, label: 'src/App.tsx' },
  ];

  for (const { file, label } of entryFiles) {
    const filePath = resolve(targetDir, file);
    if (!fileExists(filePath)) {
      const templateContent = await readTemplateFile(file);
      changes.push(createWritePreviewChange(filePath, '', templateContent, label));
    } else {
      applied.push(label);
    }
  }

  const noopMessage = changes.length === 0 ? 'React + Vite already matches canonical setup.' : undefined;

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
