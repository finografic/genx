import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fileExists, findPackageRoot, isDependencyDeclared, sortedRecord } from 'utils';
import type { FeaturePreviewResult } from '../../lib/feature-preview/feature-preview.types.js';
import type { FeatureContext } from '../feature.types';

import {
  reorderGitHookTailKeys,
  stripInlinedCommitlintFromPackageJson,
} from 'lib/migrate/package-json.utils';
import { COMMITLINT_CONFIG, PACKAGE_JSON, PKG_SIMPLE_GIT_HOOKS } from 'config/constants.config';
import type { PackageJson } from 'types/package-json.types';
import {
  createDeletePreviewChange,
  createWritePreviewChange,
} from '../../lib/feature-preview/feature-preview.utils.js';
import { packageJsonManifestDependencyFieldsChanged } from '../oxfmt/oxfmt.preview.js';
import {
  GIT_HOOKS_PACKAGES,
  HUSKY_COMMIT_MSG_CONTENT,
  HUSKY_COMMIT_MSG_PATH,
  HUSKY_PRE_COMMIT_CONTENT,
  HUSKY_PRE_COMMIT_PATH,
  LEGACY_SIMPLE_GIT_HOOK_FILES,
  LINT_STAGED_CONFIG,
} from './git-hooks.constants';

const PNPM_WORKSPACE_YAML = 'pnpm-workspace.yaml';

function formatPackageJsonString(packageJson: PackageJson): string {
  return `${JSON.stringify(packageJson, null, 2)}\n`;
}

async function withGitHooksDependencies(targetDir: string, packageJson: PackageJson): Promise<PackageJson> {
  const additions: Record<string, string> = {};
  for (const [packageName, version] of Object.entries(GIT_HOOKS_PACKAGES)) {
    if (!(await isDependencyDeclared(targetDir, packageName))) {
      additions[packageName] = version;
    }
  }
  if (Object.keys(additions).length === 0) {
    return packageJson;
  }
  const devDependencies = sortedRecord({
    ...((packageJson.devDependencies as Record<string, string> | undefined) ?? {}),
    ...additions,
  });
  return { ...packageJson, devDependencies };
}

function stripLegacySimpleGitHooks(packageJson: PackageJson): PackageJson {
  let next = { ...packageJson };

  if (PKG_SIMPLE_GIT_HOOKS in next) {
    delete next[PKG_SIMPLE_GIT_HOOKS];
  }

  if (next.devDependencies && PKG_SIMPLE_GIT_HOOKS in next.devDependencies) {
    const devDependencies = { ...next.devDependencies };
    delete devDependencies[PKG_SIMPLE_GIT_HOOKS];
    next = { ...next, devDependencies };
  }

  return next;
}

function stripAndReorder(packageJson: PackageJson): PackageJson {
  const withoutLegacyHooks = stripLegacySimpleGitHooks(packageJson);
  const stripped = stripInlinedCommitlintFromPackageJson(withoutLegacyHooks);
  return reorderGitHookTailKeys(stripped.packageJson);
}

function addHooksConfigs(packageJson: PackageJson): PackageJson {
  let next = { ...packageJson };

  if (!next['lint-staged']) {
    next['lint-staged'] = { ...LINT_STAGED_CONFIG };
    next = reorderGitHookTailKeys(next);
  }

  return next;
}

/** Map legacy `simple-git-hooks` CLI invocations to `husky` (canonical in this repo). */
function migratePreparePart(part: string): string {
  const t = part.trim();
  if (t === 'simple-git-hooks') return 'husky';
  if (t === 'npx simple-git-hooks') return 'husky';
  if (t === 'pnpm exec simple-git-hooks') return 'husky';
  return t;
}

function ensurePrepareScript(packageJson: PackageJson): PackageJson {
  const scripts = packageJson.scripts ?? {};
  const prepare = scripts.prepare ?? '';

  const rawParts = prepare
    .split('&&')
    .map((part) => part.trim())
    .filter(Boolean);

  let parts = rawParts.map(migratePreparePart);

  if (!parts.includes('husky')) {
    parts.push('husky');
  }

  const nextPrepare = parts.join(' && ') || 'husky';

  // Compare to current script; do not use an early return on *migrated* parts — that wrongly
  // skipped writes when the only segment was `simple-git-hooks` (mapped to husky in memory
  // while package.json still held `simple-git-hooks`).
  if (nextPrepare === prepare.trim()) {
    return packageJson;
  }

  return { ...packageJson, scripts: { ...scripts, prepare: nextPrepare } };
}

async function readOptionalUtf8(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === 'ENOENT'
    ) {
      return '';
    }
    throw error;
  }
}

function stripLegacySimpleGitHooksAllowBuilds(workspaceYaml: string): string {
  const next = workspaceYaml.replace(/^\s*simple-git-hooks:\s*true\s*\n?/m, '');
  return next.replace(/\n{3,}/g, '\n\n');
}

/**
 * Preview git-hooks: package.json + Husky hooks + `commitlint.config.mjs`.
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
        'package.json (lint-staged, husky, prepare)',
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

  const preCommitPath = resolve(targetDir, HUSKY_PRE_COMMIT_PATH);
  const currentPreCommit = await readOptionalUtf8(preCommitPath);
  if (currentPreCommit !== HUSKY_PRE_COMMIT_CONTENT) {
    changes.push(
      createWritePreviewChange(
        preCommitPath,
        currentPreCommit,
        HUSKY_PRE_COMMIT_CONTENT,
        HUSKY_PRE_COMMIT_PATH,
      ),
    );
  } else {
    applied.push(HUSKY_PRE_COMMIT_PATH);
  }

  const commitMsgPath = resolve(targetDir, HUSKY_COMMIT_MSG_PATH);
  const currentCommitMsg = await readOptionalUtf8(commitMsgPath);
  if (currentCommitMsg !== HUSKY_COMMIT_MSG_CONTENT) {
    changes.push(
      createWritePreviewChange(
        commitMsgPath,
        currentCommitMsg,
        HUSKY_COMMIT_MSG_CONTENT,
        HUSKY_COMMIT_MSG_PATH,
      ),
    );
  } else {
    applied.push(HUSKY_COMMIT_MSG_PATH);
  }

  for (const legacyRelativePath of LEGACY_SIMPLE_GIT_HOOK_FILES) {
    const legacyPath = resolve(targetDir, legacyRelativePath);
    if (!fileExists(legacyPath)) {
      continue;
    }
    changes.push(
      createDeletePreviewChange(
        legacyPath,
        await readOptionalUtf8(legacyPath),
        true,
        `remove legacy ${legacyRelativePath}`,
      ),
    );
  }

  const pnpmWorkspacePath = resolve(targetDir, PNPM_WORKSPACE_YAML);
  if (fileExists(pnpmWorkspacePath)) {
    const currentWorkspaceYaml = await readOptionalUtf8(pnpmWorkspacePath);
    const proposedWorkspaceYaml = stripLegacySimpleGitHooksAllowBuilds(currentWorkspaceYaml);
    if (proposedWorkspaceYaml !== currentWorkspaceYaml) {
      changes.push(
        createWritePreviewChange(
          pnpmWorkspacePath,
          currentWorkspaceYaml,
          proposedWorkspaceYaml,
          `${PNPM_WORKSPACE_YAML} (remove legacy simple-git-hooks allowBuilds)`,
        ),
      );
    }
  }

  const noopMessage =
    changes.length === 0
      ? 'Git hooks already match canonical configuration (deps, package.json, Husky hook files, commitlint file).'
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
