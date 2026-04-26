import type { Feature } from '../feature.types';

import { applyGitHooks } from './git-hooks.apply';
import { auditGitHooks, detectGitHooks } from './git-hooks.detect';

/**
 * Git Hooks feature definition.
 *
 * Sets up lint-staged for pre-commit linting and commitlint for conventional commit message enforcement.
 *
 * Detection is granular: e.g. existing lint-staged does not block migrating inlined `commitlint` in
 * package.json to `commitlint.config.mjs`.
 */
export const gitHooksFeature: Feature = {
  id: 'gitHooks',
  label: 'Git Hooks (lint-staged + commitlint)',
  hint: 'recommended',
  detect: detectGitHooks,
  audit: auditGitHooks,
  apply: applyGitHooks,
};
