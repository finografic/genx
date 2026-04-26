import { resolve } from 'node:path';
import type { AuditResult, FeatureContext } from '../feature.types';

import { hasPreviewChanges } from '../../lib/feature-preview/feature-preview.utils.js';
import { fileExists } from '../../utils/fs.utils.js';
import { OXFMT_CONFIG_FILENAME } from './css.constants.js';
import { previewCss } from './css.preview.js';

/**
 * Detect when CSS linting matches the canonical preview (deps, stylelint, VS Code, oxfmt).
 */
export async function detectCss(context: FeatureContext): Promise<boolean> {
  const preview = await previewCss(context);
  return !hasPreviewChanges(preview);
}

export async function auditCss(context: FeatureContext): Promise<AuditResult> {
  const preview = await previewCss(context);
  if (!hasPreviewChanges(preview)) return { status: 'installed' };
  const hasConfig = fileExists(resolve(context.targetDir, OXFMT_CONFIG_FILENAME));
  return hasConfig ? { status: 'partial', detail: 'config out of date' } : { status: 'missing' };
}
