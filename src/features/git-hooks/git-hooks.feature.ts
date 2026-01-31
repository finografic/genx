import type { Feature } from '../feature.types';
import { applyGitHooks } from './git-hooks.apply';
import { detectGitHooks } from './git-hooks.detect';

/**
 * Git Hooks feature definition.
 *
 * Sets up lint-staged for pre-commit linting and commitlint
 * for conventional commit message enforcement.
 */
export const gitHooksFeature: Feature = {
  id: 'gitHooks',
  label: 'Git Hooks (lint-staged + commitlint)',
  hint: 'recommended',
  detect: detectGitHooks,
  apply: applyGitHooks,
};
