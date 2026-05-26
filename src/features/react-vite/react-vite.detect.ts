import type { AuditResult, FeatureContext } from '../feature.types';

import { hasPreviewChanges } from '../../lib/feature-preview/feature-preview.utils.js';
import { isDependencyDeclared } from '../../utils/package-manager.utils.js';
import { REACT_VITE_PRIMARY_PACKAGE } from './react-vite.constants';
import { previewReactVite } from './react-vite.preview.js';

/**
 * Detect if react-vite feature is fully present — aligned with `previewReactVite`.
 */
export async function detectReactVite(context: FeatureContext): Promise<boolean> {
  const preview = await previewReactVite(context);
  return !hasPreviewChanges(preview);
}

export async function auditReactVite(context: FeatureContext): Promise<AuditResult> {
  const preview = await previewReactVite(context);
  if (!hasPreviewChanges(preview)) return { status: 'installed' };
  const hasPkg = await isDependencyDeclared(context.targetDir, REACT_VITE_PRIMARY_PACKAGE);
  return hasPkg ? { status: 'partial', detail: 'config out of date' } : { status: 'missing' };
}
