/**
 * Git Hooks feature configuration.
 *
 * This feature sets up lint-staged, commitlint, and simple-git-hooks
 * for enforcing code quality and conventional commit messages.
 */

import {
  PKG_COMMITLINT_CLI,
  PKG_COMMITLINT_CONFIG,
  PKG_LINT_STAGED,
  PKG_SIMPLE_GIT_HOOKS,
} from 'config/constants.config';

export const GIT_HOOKS_PACKAGES = {
  [PKG_COMMITLINT_CLI]: 'latest',
  [PKG_COMMITLINT_CONFIG]: 'latest',
  [PKG_LINT_STAGED]: 'latest',
  [PKG_SIMPLE_GIT_HOOKS]: 'latest',
} as const;

/**
 * lint-staged configuration for package.json.
 * Matches dprint’s code glob when that feature prepends `dprint fmt`.
 */
export const LINT_STAGED_CONFIG: Record<string, string[]> = {
  '*.{ts,tsx,js,jsx,mjs,cjs}': ['eslint --fix'],
};

/**
 * simple-git-hooks configuration for package.json.
 */
export const SIMPLE_GIT_HOOKS_CONFIG: Record<string, string> = {
  'pre-commit': 'npx lint-staged --allow-empty',
};

/**
 * commitlint configuration inlined in package.json (replaces commitlint.config.*).
 */
export const COMMITLINT_PACKAGE_JSON_CONFIG = {
  extends: [PKG_COMMITLINT_CONFIG],
} as const;
