import type { AuditResult, FeatureContext } from '../feature.types';

import { hasPreviewChanges } from '../../lib/feature-preview/feature-preview.utils.js';
import { isDependencyDeclared } from '../../utils/package-manager.utils.js';
import { previewVitest } from './vitest.preview.js';

/**
 * Detect if vitest feature is fully present (config, scripts, dependency) — aligned with `previewVitest`.
 */
export async function detectVitest(context: FeatureContext): Promise<boolean> {
  const preview = await previewVitest(context);
  return !hasPreviewChanges(preview);
}

export async function auditVitest(context: FeatureContext): Promise<AuditResult> {
  const preview = await previewVitest(context);
  if (!hasPreviewChanges(preview)) return { status: 'installed' };
  const hasPkg = await isDependencyDeclared(context.targetDir, 'vitest');
  return hasPkg ? { status: 'partial', detail: 'config out of date' } : { status: 'missing' };
}
