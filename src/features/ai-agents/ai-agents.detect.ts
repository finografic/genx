import { resolve } from 'node:path';
import type { AuditResult, FeatureContext } from '../feature.types';

import { hasPreviewChanges } from '../../lib/feature-preview/feature-preview.utils.js';
import { fileExists } from '../../utils/fs.utils.js';
import { previewAiAgents } from './ai-agents.preview.js';

/**
 * Detect when ai-agents has nothing left to apply — aligned with `previewAiAgents`.
 */
export async function detectAiAgents(context: FeatureContext): Promise<boolean> {
  const preview = await previewAiAgents(context);
  return !hasPreviewChanges(preview);
}

export async function auditAiAgents(context: FeatureContext): Promise<AuditResult> {
  const preview = await previewAiAgents(context);
  if (!hasPreviewChanges(preview)) return { status: 'installed' };
  const hasFile = fileExists(resolve(context.targetDir, 'AGENTS.md'));
  return hasFile ? { status: 'partial', detail: 'AGENTS.md out of date' } : { status: 'missing' };
}
