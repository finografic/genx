import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileExists, isDependencyDeclared } from 'utils';
import type { FeatureContext } from '../feature.types';

import { COMMITLINT_CONFIG, PACKAGE_JSON } from 'config/constants.config';
import type { PackageJson } from 'types/package-json.types';
import { GIT_HOOKS_PACKAGES } from './git-hooks.constants';

/**
 * True when the git-hooks feature has nothing left to apply: dependencies, `lint-staged`,
 * `simple-git-hooks`, `prepare`, `commitlint.config.mjs`, and no inlined `commitlint` in package.json.
 *
 * Lint-staged and commitlint are checked independently — e.g. existing lint-staged does not skip
 * migrating commitlint off `package.json` onto `commitlint.config.mjs`.
 */
export async function isGitHooksFullyConfigured(targetDir: string): Promise<boolean> {
  const packageJsonPath = resolve(targetDir, PACKAGE_JSON);
  if (!fileExists(packageJsonPath)) {
    return false;
  }

  const raw = await readFile(packageJsonPath, 'utf8');
  const packageJson = JSON.parse(raw) as PackageJson;

  if ('commitlint' in packageJson) {
    return false;
  }

  if (!fileExists(resolve(targetDir, COMMITLINT_CONFIG))) {
    return false;
  }

  if (!packageJson['lint-staged']) {
    return false;
  }

  if (!packageJson['simple-git-hooks']) {
    return false;
  }

  for (const packageName of Object.keys(GIT_HOOKS_PACKAGES)) {
    if (!(await isDependencyDeclared(targetDir, packageName))) {
      return false;
    }
  }

  const prepare = packageJson.scripts?.prepare ?? '';
  if (!prepare.includes('simple-git-hooks')) {
    return false;
  }

  return true;
}

/**
 * Used by `genx features` / migrate: when `true`, the feature is skipped (nothing to do).
 */
export async function detectGitHooks(context: FeatureContext): Promise<boolean> {
  return isGitHooksFullyConfigured(context.targetDir);
}
