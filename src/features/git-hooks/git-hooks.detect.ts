import { isDependencyDeclared } from 'utils';
import type { FeatureContext } from '../feature.types';

/**
 * Detect if git hooks are already configured.
 * Checks for lint-staged in dependencies.
 */
export async function detectGitHooks(context: FeatureContext): Promise<boolean> {
  return isDependencyDeclared(context.targetDir, 'lint-staged');
}
