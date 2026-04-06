import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  copyFileDirect,
  fileExists,
  findPackageRoot,
  installDevDependency,
  isDependencyDeclared,
  spinner,
  successMessage,
  warnMessage,
} from 'utils';
import type { FeatureApplyResult, FeatureContext } from '../feature.types';

import {
  reorderGitHookTailKeys,
  stripInlinedCommitlintFromPackageJson,
} from 'lib/migrate/package-json.utils';
import { COMMITLINT_CONFIG, PACKAGE_JSON } from 'config/constants.config';
import type { PackageJson } from 'types/package-json.types';
import { GIT_HOOKS_PACKAGES, LINT_STAGED_CONFIG, SIMPLE_GIT_HOOKS_CONFIG } from './git-hooks.constants';

/**
 * Add lint-staged and simple-git-hooks to package.json when missing.
 */
async function addPackageJsonHooksConfigs(
  targetDir: string,
): Promise<{ addedLintStaged: boolean; addedSimpleGitHooks: boolean }> {
  const packageJsonPath = resolve(targetDir, PACKAGE_JSON);
  const raw = await readFile(packageJsonPath, 'utf8');
  let packageJson = JSON.parse(raw) as PackageJson;

  let addedLintStaged = false;
  let addedSimpleGitHooks = false;

  if (!packageJson['lint-staged']) {
    packageJson['lint-staged'] = { ...LINT_STAGED_CONFIG };
    addedLintStaged = true;
  }

  if (!packageJson['simple-git-hooks']) {
    packageJson['simple-git-hooks'] = { ...SIMPLE_GIT_HOOKS_CONFIG };
    addedSimpleGitHooks = true;
  }

  if (addedLintStaged || addedSimpleGitHooks) {
    packageJson = reorderGitHookTailKeys(packageJson);
    await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
  }

  return { addedLintStaged, addedSimpleGitHooks };
}

/**
 * Remove inlined `commitlint` from package.json when present (superseded by `commitlint.config.mjs`).
 */
async function stripPackageJsonCommitlint(targetDir: string): Promise<boolean> {
  const packageJsonPath = resolve(targetDir, PACKAGE_JSON);
  const raw = await readFile(packageJsonPath, 'utf8');
  let packageJson = JSON.parse(raw) as PackageJson;
  const { packageJson: stripped, changed } = stripInlinedCommitlintFromPackageJson(packageJson);
  if (!changed) {
    return false;
  }
  packageJson = reorderGitHookTailKeys(stripped);
  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
  return true;
}

/**
 * Copy `commitlint.config.mjs` from genx `_templates/` when the target repo does not have it.
 */
async function ensureCommitlintConfigFile(targetDir: string): Promise<boolean> {
  const dest = resolve(targetDir, COMMITLINT_CONFIG);
  if (fileExists(dest)) {
    return false;
  }

  const fromDir = fileURLToPath(new URL('.', import.meta.url));
  const packageRoot = findPackageRoot(fromDir);
  const src = resolve(packageRoot, '_templates', COMMITLINT_CONFIG);
  if (!fileExists(src)) {
    throw new Error(`commitlint template not found: ${src}`);
  }
  await copyFileDirect(src, dest);
  return true;
}

/**
 * Check if prepare script includes simple-git-hooks.
 */
async function ensurePrepareScript(targetDir: string): Promise<boolean> {
  const packageJsonPath = resolve(targetDir, PACKAGE_JSON);
  const raw = await readFile(packageJsonPath, 'utf8');
  const packageJson = JSON.parse(raw) as PackageJson;

  const scripts = packageJson.scripts ?? {};
  const prepare = scripts.prepare ?? '';

  if (prepare.includes('simple-git-hooks')) {
    return false;
  }

  if (prepare) {
    scripts.prepare = `${prepare} && simple-git-hooks`;
  } else {
    scripts.prepare = 'simple-git-hooks';
  }

  packageJson.scripts = scripts;
  const formatted = `${JSON.stringify(packageJson, null, 2)}\n`;
  await writeFile(packageJsonPath, formatted, 'utf8');

  return true;
}

/**
 * Apply git hooks feature to an existing package.
 */
export async function applyGitHooks(context: FeatureContext): Promise<FeatureApplyResult> {
  const applied: string[] = [];

  for (const [packageName, version] of Object.entries(GIT_HOOKS_PACKAGES)) {
    const alreadyDeclared = await isDependencyDeclared(context.targetDir, packageName);
    if (!alreadyDeclared) {
      const installSpin = spinner();
      installSpin.start(`Installing ${packageName}...`);
      const installResult = await installDevDependency(context.targetDir, packageName, version);
      installSpin.stop(
        installResult.installed ? `Installed ${packageName}` : `${packageName} already installed`,
      );
      if (installResult.installed) {
        applied.push(packageName);
      }
    }
  }

  const strippedCommitlint = await stripPackageJsonCommitlint(context.targetDir);
  if (strippedCommitlint) {
    applied.push('package.json (removed inlined commitlint)');
    successMessage('Removed commitlint key from package.json (use commitlint.config.mjs)');
  }

  const configResult = await addPackageJsonHooksConfigs(context.targetDir);
  if (configResult.addedLintStaged) {
    applied.push('package.json (lint-staged config)');
    successMessage('Added lint-staged config to package.json');
  }
  if (configResult.addedSimpleGitHooks) {
    applied.push('package.json (simple-git-hooks config)');
    successMessage('Added simple-git-hooks config to package.json');
  }

  const addedCommitlintFile = await ensureCommitlintConfigFile(context.targetDir);
  if (addedCommitlintFile) {
    applied.push(COMMITLINT_CONFIG);
    successMessage(`Added ${COMMITLINT_CONFIG} from template`);
  }

  const prepareAdded = await ensurePrepareScript(context.targetDir);
  if (prepareAdded) {
    applied.push('package.json (prepare script)');
    successMessage('Added simple-git-hooks to prepare script');
  }

  if (applied.length > 0) {
    warnMessage('Run "pnpm prepare" to activate git hooks');
  }

  if (applied.length === 0) {
    return { applied, noopMessage: 'Git hooks already configured. No changes made.' };
  }

  return { applied };
}
