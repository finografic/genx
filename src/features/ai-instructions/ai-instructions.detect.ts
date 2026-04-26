import { resolve } from 'node:path';
import type { AuditResult, FeatureContext } from '../feature.types';

import { hasPreviewChanges } from '../../lib/feature-preview/feature-preview.utils.js';
import { fileExists } from '../../utils/fs.utils.js';
import { AI_INSTRUCTIONS_FILES } from './ai-instructions.constants.js';
import { previewAiInstructions } from './ai-instructions.preview.js';

/**
 * Detect when AI instructions are fully aligned with the canonical preview.
 */
export async function detectAiInstructions(context: FeatureContext): Promise<boolean> {
  const preview = await previewAiInstructions(context);
  return !hasPreviewChanges(preview);
}

export async function auditAiInstructions(context: FeatureContext): Promise<AuditResult> {
  const preview = await previewAiInstructions(context);
  if (!hasPreviewChanges(preview)) return { status: 'installed' };
  const hasDir = fileExists(resolve(context.targetDir, AI_INSTRUCTIONS_FILES[1]));
  return hasDir ? { status: 'partial', detail: 'instructions out of date' } : { status: 'missing' };
}
