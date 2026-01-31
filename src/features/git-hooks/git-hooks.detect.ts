import { isDependencyDeclared } from 'utils';
import { PKG_LINT_STAGED } from 'config/constants.config';
import type { FeatureContext } from '../feature.types';

/**
 * Detect if git hooks are already configured.
 * Checks for lint-staged in dependencies.
 */
export async function detectGitHooks(context: FeatureContext): Promise<boolean> {
  return isDependencyDeclared(context.targetDir, PKG_LINT_STAGED);
}
