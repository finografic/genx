import { fileExists } from 'utils';
import type { FeatureContext } from '../feature.types';
import { STYLELINTRC_FILENAME } from './css.constants';

/**
 * Detect if CSS linting is already configured.
 * Checks for .stylelintrc.json in the target directory.
 */
export function detectCss(context: FeatureContext): boolean {
  return fileExists(`${context.targetDir}/${STYLELINTRC_FILENAME}`);
}
