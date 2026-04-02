import { readFile, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  fileExists,
  installDevDependency,
  isDependencyDeclared,
  spinner,
  successMessage,
  warnMessage,
} from 'utils';
import type { FeatureApplyResult, FeatureContext } from '../feature.types';

import { COMMITLINT_CONFIG, PACKAGE_JSON } from 'config/constants.config';
import type { PackageJson } from 'types/package-json.types';
import {
  COMMITLINT_PACKAGE_JSON_CONFIG,
  GIT_HOOKS_PACKAGES,
  LINT_STAGED_CONFIG,
  SIMPLE_GIT_HOOKS_CONFIG,
} from './git-hooks.constants';

/**
 * Keep `lint-staged`, `commitlint`, and `simple-git-hooks` at the end of package.json
 * in that order (matches repo convention).
 */
function reorderGitHookTailKeys(packageJson: PackageJson): PackageJson {
  const { 'lint-staged': lintStaged, commitlint, 'simple-git-hooks': simpleGitHooks, ...rest } = packageJson;

  return {
    ...rest,
    ...(lintStaged !== undefined ? { 'lint-staged': lintStaged } : {}),
    ...(commitlint !== undefined && commitlint !== null ? { commitlint } : {}),
    ...(simpleGitHooks !== undefined ? { 'simple-git-hooks': simpleGitHooks } : {}),
  };
}

/**
 * Add lint-staged, commitlint, and simple-git-hooks to package.json when missing.
 */
async function addPackageJsonConfigs(
  targetDir: string,
): Promise<{ addedLintStaged: boolean; addedCommitlint: boolean; addedSimpleGitHooks: boolean }> {
  const packageJsonPath = resolve(targetDir, PACKAGE_JSON);
  const raw = await readFile(packageJsonPath, 'utf8');
  let packageJson = JSON.parse(raw) as PackageJson;

  let addedLintStaged = false;
  let addedCommitlint = false;
  let addedSimpleGitHooks = false;

  if (!packageJson['lint-staged']) {
    packageJson['lint-staged'] = { ...LINT_STAGED_CONFIG };
    addedLintStaged = true;
  }

  if (!packageJson.commitlint) {
    packageJson.commitlint = { extends: [...COMMITLINT_PACKAGE_JSON_CONFIG.extends] };
    addedCommitlint = true;
  }

  if (!packageJson['simple-git-hooks']) {
    packageJson['simple-git-hooks'] = { ...SIMPLE_GIT_HOOKS_CONFIG };
    addedSimpleGitHooks = true;
  }

  if (addedLintStaged || addedCommitlint || addedSimpleGitHooks) {
    packageJson = reorderGitHookTailKeys(packageJson);
    await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
  }

  return { addedLintStaged, addedCommitlint, addedSimpleGitHooks };
}

/**
 * Remove legacy commitlint.config.mjs when package.json carries commitlint config.
 */
async function removeLegacyCommitlintConfig(targetDir: string): Promise<boolean> {
  const configPath = resolve(targetDir, COMMITLINT_CONFIG);
  if (!fileExists(configPath)) {
    return false;
  }

  await unlink(configPath);
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

  // Check if simple-git-hooks is already in prepare
  if (prepare.includes('simple-git-hooks')) {
    return false;
  }

  // Add or update prepare script
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

  // 1. Install all required packages
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

  // 2. Add lint-staged, commitlint (package.json), and simple-git-hooks
  const configResult = await addPackageJsonConfigs(context.targetDir);
  if (configResult.addedLintStaged) {
    applied.push('package.json (lint-staged config)');
    successMessage('Added lint-staged config to package.json');
  }
  if (configResult.addedCommitlint) {
    applied.push('package.json (commitlint config)');
    successMessage('Added commitlint config to package.json');
  }
  if (configResult.addedSimpleGitHooks) {
    applied.push('package.json (simple-git-hooks config)');
    successMessage('Added simple-git-hooks config to package.json');
  }

  // 3. Drop legacy commitlint.config.mjs if present (config lives in package.json)
  const legacyRemoved = await removeLegacyCommitlintConfig(context.targetDir);
  if (legacyRemoved) {
    applied.push(`${COMMITLINT_CONFIG} (removed)`);
    successMessage(`Removed ${COMMITLINT_CONFIG}; using package.json "commitlint"`);
  }

  // 4. Ensure prepare script includes simple-git-hooks
  const prepareAdded = await ensurePrepareScript(context.targetDir);
  if (prepareAdded) {
    applied.push('package.json (prepare script)');
    successMessage('Added simple-git-hooks to prepare script');
  }

  // 5. Remind user to run prepare
  if (applied.length > 0) {
    warnMessage('Run "pnpm prepare" to activate git hooks');
  }

  if (applied.length === 0) {
    return { applied, noopMessage: 'Git hooks already configured. No changes made.' };
  }

  return { applied };
}
