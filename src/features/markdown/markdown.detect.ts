import { isDependencyDeclared } from 'utils';
import type { FeatureContext } from '../feature.types';

import { MARKDOWNLINT_PACKAGE } from './markdown.constants';

/**
 * Detect if markdown linting is already configured.
 * Checks for eslint-plugin-markdownlint in dependencies.
 */
export async function detectMarkdown(context: FeatureContext): Promise<boolean> {
  return isDependencyDeclared(context.targetDir, MARKDOWNLINT_PACKAGE);
}
