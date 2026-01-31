import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  fileExists,
  installDevDependency,
  isDependencyDeclared,
  spinner,
  successMessage,
  warnMessage,
} from 'utils';
import type { PackageJson } from 'types/package-json.types';
import type { FeatureApplyResult, FeatureContext } from '../feature.types';
import {
  COMMITLINT_CONFIG_CONTENT,
  COMMITLINT_CONFIG_FILE,
  GIT_HOOKS_PACKAGES,
  LINT_STAGED_CONFIG,
  SIMPLE_GIT_HOOKS_CONFIG,
} from './git-hooks.constants';

/**
 * Add lint-staged and simple-git-hooks config to package.json.
 * Places them at the end of the file, with simple-git-hooks last.
 */
async function addPackageJsonConfigs(
  targetDir: string,
): Promise<{ addedLintStaged: boolean; addedSimpleGitHooks: boolean }> {
  const packageJsonPath = resolve(targetDir, 'package.json');
  const raw = await readFile(packageJsonPath, 'utf8');
  const packageJson = JSON.parse(raw) as PackageJson;

  let addedLintStaged = false;
  let addedSimpleGitHooks = false;

  // Add lint-staged config if not present
  if (!packageJson['lint-staged']) {
    packageJson['lint-staged'] = LINT_STAGED_CONFIG;
    addedLintStaged = true;
  }

  // Add simple-git-hooks config if not present
  if (!packageJson['simple-git-hooks']) {
    packageJson['simple-git-hooks'] = SIMPLE_GIT_HOOKS_CONFIG;
    addedSimpleGitHooks = true;
  }

  if (addedLintStaged || addedSimpleGitHooks) {
    // Reorder to ensure lint-staged comes before simple-git-hooks at the end
    const { 'lint-staged': lintStaged, 'simple-git-hooks': simpleGitHooks, ...rest } = packageJson;

    const reordered = {
      ...rest,
      ...(lintStaged ? { 'lint-staged': lintStaged } : {}),
      ...(simpleGitHooks ? { 'simple-git-hooks': simpleGitHooks } : {}),
    };

    const formatted = `${JSON.stringify(reordered, null, 2)}\n`;
    await writeFile(packageJsonPath, formatted, 'utf8');
  }

  return { addedLintStaged, addedSimpleGitHooks };
}

/**
 * Create commitlint.config.mjs if it doesn't exist.
 */
async function createCommitlintConfig(targetDir: string): Promise<boolean> {
  const configPath = resolve(targetDir, COMMITLINT_CONFIG_FILE);

  if (fileExists(configPath)) {
    return false;
  }

  await writeFile(configPath, COMMITLINT_CONFIG_CONTENT, 'utf8');
  return true;
}

/**
 * Check if prepare script includes simple-git-hooks.
 */
async function ensurePrepareScript(targetDir: string): Promise<boolean> {
  const packageJsonPath = resolve(targetDir, 'package.json');
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
        installResult.installed
          ? `Installed ${packageName}`
          : `${packageName} already installed`,
      );
      if (installResult.installed) {
        applied.push(packageName);
      }
    }
  }

  // 2. Add lint-staged and simple-git-hooks config to package.json
  const configResult = await addPackageJsonConfigs(context.targetDir);
  if (configResult.addedLintStaged) {
    applied.push('package.json (lint-staged config)');
    successMessage('Added lint-staged config to package.json');
  }
  if (configResult.addedSimpleGitHooks) {
    applied.push('package.json (simple-git-hooks config)');
    successMessage('Added simple-git-hooks config to package.json');
  }

  // 3. Create commitlint.config.mjs
  const commitlintCreated = await createCommitlintConfig(context.targetDir);
  if (commitlintCreated) {
    applied.push(COMMITLINT_CONFIG_FILE);
    successMessage(`Created ${COMMITLINT_CONFIG_FILE}`);
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
