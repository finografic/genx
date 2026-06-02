import { basename } from 'node:path';
import type { AuditResult, FeatureContext } from '../feature.types';

import {
  getChangedPreviewChanges,
  hasPreviewChanges,
} from '../../lib/feature-preview/feature-preview.utils.js';
import { getAssociatedLegacyRootFiles } from '../../lib/legacy-removal.utils.js';
import { isDependencyDeclared } from '../../utils/package-manager.utils.js';
import { PRETTIER_CONFIG_FILES, OXC_CONFIG_PACKAGE } from './oxc-config.constants.js';
import { previewOxcConfig } from './oxc-config.preview.js';

const OXC_CONFIG_CORE_FILENAMES = new Set([
  'package.json',
  'oxfmt.config.ts',
  'oxlint.config.ts',
  ...PRETTIER_CONFIG_FILES,
  ...getAssociatedLegacyRootFiles('oxc-config'),
]);

function isCoreOxcConfigAuditPath(path: string): boolean {
  return OXC_CONFIG_CORE_FILENAMES.has(basename(path));
}

/**
 * Detect if oxc-config is already fully configured in the target directory. Uses `previewOxcConfig`
 * (package.json, config, VS Code, Prettier cleanup surfaces) — returns true only
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
  if (!hasPkg) return { status: 'missing' };

  const hasCoreDrift = getChangedPreviewChanges(preview.changes).some((change) =>
    isCoreOxcConfigAuditPath(change.path),
  );

  return hasCoreDrift ? { status: 'partial', detail: 'config out of date' } : { status: 'installed' };
}
