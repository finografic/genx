import type { AuditResult, FeatureContext } from '../feature.types';

import { hasPreviewChanges } from '../../lib/feature-preview/feature-preview.utils.js';
import { isDependencyDeclared } from '../../utils/package-manager.utils.js';
import { OXC_CONFIG_PACKAGE } from './oxc-config.constants.js';
import { previewOxcConfig } from './oxc-config.preview.js';

/**
 * Detect if oxc-config is already fully configured in the target directory. Uses `previewOxcConfig`
 * (package.json, config, workflows, VS Code, ESLint, Prettier/dprint cleanup surfaces) — returns true only
 * when preview reports no relevant file changes.
 */
export async function detectOxcConfig(context: FeatureContext): Promise<boolean> {
  const preview = await previewOxcConfig(context);
  return !hasPreviewChanges(preview);
}

export async function auditOxcConfig(context: FeatureContext): Promise<AuditResult> {
  const preview = await previewOxcConfig(context);
  if (!hasPreviewChanges(preview)) return { status: 'installed' };
  const hasPkg = await isDependencyDeclared(context.targetDir, OXC_CONFIG_PACKAGE);
  return hasPkg ? { status: 'partial', detail: 'config out of date' } : { status: 'missing' };
}
