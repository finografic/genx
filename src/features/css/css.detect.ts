import { resolve } from 'node:path';

import { fileExists } from 'utils';
import type { FeatureContext } from '../feature.types';
import { LEGACY_STYLELINTRC_FILENAME, STYLELINT_CONFIG_FILENAME } from './css.constants';

/**
 * Detect if CSS linting is already configured.
 * True when `stylelint.config.ts` or legacy `.stylelintrc.json` is present.
 */
export function detectCss(context: FeatureContext): boolean {
  const root = context.targetDir;
  return (
    fileExists(resolve(root, STYLELINT_CONFIG_FILENAME))
    || fileExists(resolve(root, LEGACY_STYLELINTRC_FILENAME))
  );
}
