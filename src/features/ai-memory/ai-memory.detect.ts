import { resolve } from 'node:path';
import type { AuditResult, FeatureContext } from '../feature.types';

import { hasPreviewChanges } from '../../lib/feature-preview/feature-preview.utils.js';
import { fileExists } from '../../utils/fs.utils.js';
import { AI_MEMORY_FILES } from './ai-memory.constants.js';
import { previewAiMemory } from './ai-memory.preview.js';

/**
 * Detect when the project memory model matches the canonical preview.
 */
export async function detectAiMemory(context: FeatureContext): Promise<boolean> {
  const preview = await previewAiMemory(context);
  return !hasPreviewChanges(preview);
}

export async function auditAiMemory(context: FeatureContext): Promise<AuditResult> {
  const preview = await previewAiMemory(context);
  if (!hasPreviewChanges(preview)) return { status: 'installed' };
  const hasFile = fileExists(resolve(context.targetDir, AI_MEMORY_FILES[0]));
  return hasFile ? { status: 'partial', detail: 'project memory model out of date' } : { status: 'missing' };
}
