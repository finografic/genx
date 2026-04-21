/**
 * Git Hooks feature configuration.
 *
 * Sets up lint-staged, commitlint (`commitlint.config.mjs`), and Husky hook files.
 */

import {
  PKG_COMMITLINT_CLI,
  PKG_COMMITLINT_CONFIG,
  PKG_HUSKY,
  PKG_LINT_STAGED,
} from 'config/constants.config';

import { OXFMT_LINT_STAGED_COMMAND, OXLINT_LINT_STAGED_FIX } from '../oxc-config/oxc-config.constants';

export const GIT_HOOKS_PACKAGES = {
  [PKG_COMMITLINT_CLI]: 'latest',
  [PKG_COMMITLINT_CONFIG]: 'latest',
  [PKG_HUSKY]: 'latest',
  [PKG_LINT_STAGED]: 'latest',
} as const;

/**
 * Lint-staged configuration for package.json (aligned with `_templates/package.json` + oxc-config).
 */
export const LINT_STAGED_CONFIG: Record<string, string[]> = {
  '*.{ts,tsx,js,jsx,mjs,cjs}': [OXFMT_LINT_STAGED_COMMAND, OXLINT_LINT_STAGED_FIX],
};

/**
 * Canonical Husky hook files written by the git-hooks feature.
 */
export const HUSKY_PRE_COMMIT_PATH = '.husky/pre-commit';
export const HUSKY_COMMIT_MSG_PATH = '.husky/commit-msg';
export const HUSKY_PRE_COMMIT_CONTENT = 'pnpm exec lint-staged --allow-empty\n';
export const HUSKY_COMMIT_MSG_CONTENT = 'pnpm exec commitlint --edit "$1"\n';
export const LEGACY_SIMPLE_GIT_HOOK_FILES = ['.simple-git-hooks.mjs', '.simple-git-hooks.js'] as const;
