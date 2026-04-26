import type { AuditResult, FeatureContext } from '../feature.types';

import { hasPreviewChanges } from '../../lib/feature-preview/feature-preview.utils.js';
import { isDependencyDeclared } from '../../utils/package-manager.utils.js';
import { MD_LINT_PACKAGE } from './markdown.constants.js';
import { previewMarkdown } from './markdown.preview.js';

/**
 * Detect if markdown linting is already fully configured for owned files (deps, ESLint block, VS Code,
 * lint-staged, CSS assets).
 */
export async function detectMarkdown(context: FeatureContext): Promise<boolean> {
  const preview = await previewMarkdown(context);
  return !hasPreviewChanges(preview);
}

export async function auditMarkdown(context: FeatureContext): Promise<AuditResult> {
  const preview = await previewMarkdown(context);
  if (!hasPreviewChanges(preview)) return { status: 'installed' };
  const hasPkg = await isDependencyDeclared(context.targetDir, MD_LINT_PACKAGE);
  return hasPkg ? { status: 'partial', detail: 'config out of date' } : { status: 'missing' };
}
