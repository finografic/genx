import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fileExists, findPackageRoot, isDependencyDeclared } from 'utils';
import type { FeaturePreviewResult } from '../../lib/feature-preview/feature-preview.types.js';
import type { FeatureContext } from '../feature.types';

import {
  reorderGitHookTailKeys,
  stripInlinedCommitlintFromPackageJson,
} from 'lib/migrate/package-json.utils';
import { COMMITLINT_CONFIG, PACKAGE_JSON } from 'config/constants.config';
import type { PackageJson } from 'types/package-json.types';
import { createWritePreviewChange } from '../../lib/feature-preview/feature-preview.utils.js';
import { packageJsonManifestDependencyFieldsChanged } from '../oxfmt/oxfmt.preview.js';
import { GIT_HOOKS_PACKAGES, LINT_STAGED_CONFIG, SIMPLE_GIT_HOOKS_CONFIG } from './git-hooks.constants';

function formatPackageJsonString(packageJson: PackageJson): string {
  return `${JSON.stringify(packageJson, null, 2)}\n`;
}

async function withGitHooksDependencies(targetDir: string, packageJson: PackageJson): Promise<PackageJson> {
  let next = packageJson;
  for (const [packageName, version] of Object.entries(GIT_HOOKS_PACKAGES)) {
    if (await isDependencyDeclared(targetDir, packageName)) {
      continue;
    }
    const devDependencies = { ...(next.devDependencies ?? {}), [packageName]: version };
    next = { ...next, devDependencies };
  }
  return next;
}

function stripAndReorder(packageJson: PackageJson): PackageJson {
  const stripped = stripInlinedCommitlintFromPackageJson(packageJson);
  return reorderGitHookTailKeys(stripped.packageJson);
}

function addHooksConfigs(packageJson: PackageJson): PackageJson {
  let next = { ...packageJson };
  let added = false;

  if (!next['lint-staged']) {
    next['lint-staged'] = { ...LINT_STAGED_CONFIG };
    added = true;
  }

  if (!next['simple-git-hooks']) {
    next['simple-git-hooks'] = { ...SIMPLE_GIT_HOOKS_CONFIG };
    added = true;
  }

  if (added) {
    next = reorderGitHookTailKeys(next);
  }

  return next;
}

function ensurePrepareScript(packageJson: PackageJson): PackageJson {
  const scripts = packageJson.scripts ?? {};
  const prepare = scripts.prepare ?? '';

  if (prepare.includes('simple-git-hooks')) {
    return packageJson;
  }

  const nextScripts = { ...scripts };
  if (prepare) {
    nextScripts.prepare = `${prepare} && simple-git-hooks`;
  } else {
    nextScripts.prepare = 'simple-git-hooks';
  }

  return { ...packageJson, scripts: nextScripts };
}

/**
 * Preview git-hooks: package.json hooks + `commitlint.config.mjs` from template when missing.
 */
export async function previewGitHooks(context: FeatureContext): Promise<FeaturePreviewResult> {
  const { targetDir } = context;
  const changes: FeaturePreviewResult['changes'] = [];
  const applied: string[] = [];

  const packageJsonPath = resolve(targetDir, PACKAGE_JSON);
  const rawPkg = await readFile(packageJsonPath, 'utf8');
  let pkg = JSON.parse(rawPkg) as PackageJson;

  pkg = await withGitHooksDependencies(targetDir, pkg);
  pkg = stripAndReorder(pkg);
  pkg = addHooksConfigs(pkg);
  pkg = ensurePrepareScript(pkg);

  const proposedPkgRaw = formatPackageJsonString(pkg);
  if (proposedPkgRaw !== rawPkg) {
    changes.push(
      createWritePreviewChange(
        packageJsonPath,
        rawPkg,
        proposedPkgRaw,
        'package.json (lint-staged, simple-git-hooks, prepare)',
      ),
    );
  } else {
    applied.push('package.json (git hooks manifest)');
  }

  const commitlintDest = resolve(targetDir, COMMITLINT_CONFIG);
  if (!fileExists(commitlintDest)) {
    const fromDir = fileURLToPath(new URL('.', import.meta.url));
    const packageRoot = findPackageRoot(fromDir);
    const src = resolve(packageRoot, '_templates', COMMITLINT_CONFIG);
    if (!fileExists(src)) {
      throw new Error(`commitlint template not found: ${src}`);
    }
    const body = await readFile(src, 'utf8');
    changes.push(createWritePreviewChange(commitlintDest, '', body, COMMITLINT_CONFIG));
  } else {
    applied.push(COMMITLINT_CONFIG);
  }

  const noopMessage =
    changes.length === 0
      ? 'Git hooks already match canonical configuration (deps, package.json, commitlint file).'
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
