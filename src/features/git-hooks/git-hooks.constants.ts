/**
 * Git Hooks feature configuration.
 *
 * This feature sets up lint-staged, commitlint, and simple-git-hooks
 * for enforcing code quality and conventional commit messages.
 */

import {
  COMMITLINT_CONFIG,
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
 */
export const LINT_STAGED_CONFIG: Record<string, string[]> = {
  '*.{ts,tsx,js,mjs,cjs}': ['eslint --fix'],
};

/**
 * simple-git-hooks configuration for package.json.
 */
export const SIMPLE_GIT_HOOKS_CONFIG: Record<string, string> = {
  'pre-commit': 'npx lint-staged',
};

/**
 * Commitlint config filename.
 */
export const COMMITLINT_CONFIG_FILE = COMMITLINT_CONFIG;

/**
 * Commitlint config content.
 */
export const COMMITLINT_CONFIG_CONTENT = `export default {
  extends: ['${PKG_COMMITLINT_CONFIG}'],
};
`;
