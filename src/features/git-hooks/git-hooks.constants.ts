/**
 * Git Hooks feature configuration.
 *
 * This feature sets up lint-staged, commitlint, and simple-git-hooks
 * for enforcing code quality and conventional commit messages.
 */

export const GIT_HOOKS_PACKAGES = {
  '@commitlint/cli': 'latest',
  '@commitlint/config-conventional': 'latest',
  'lint-staged': 'latest',
  'simple-git-hooks': 'latest',
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
export const COMMITLINT_CONFIG_FILE = 'commitlint.config.mjs';

/**
 * Commitlint config content.
 */
export const COMMITLINT_CONFIG_CONTENT = `export default {
  extends: ['@commitlint/config-conventional'],
};
`;
