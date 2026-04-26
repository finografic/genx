import { resolve } from 'node:path';
import type { AuditResult, FeatureContext } from '../feature.types';

import { hasPreviewChanges } from '../../lib/feature-preview/feature-preview.utils.js';
import { fileExists } from '../../utils/fs.utils.js';
import { AI_CLAUDE_FILES } from './ai-claude.constants.js';
import { previewAiClaude } from './ai-claude.preview.js';

/**
 * Detect when Claude Code support matches the canonical preview.
 */
export async function detectAiClaude(context: FeatureContext): Promise<boolean> {
  const preview = await previewAiClaude(context);
  return !hasPreviewChanges(preview);
}

export async function auditAiClaude(context: FeatureContext): Promise<AuditResult> {
  const preview = await previewAiClaude(context);
  if (!hasPreviewChanges(preview)) return { status: 'installed' };
  const hasFile = fileExists(resolve(context.targetDir, AI_CLAUDE_FILES[0]));
  return hasFile ? { status: 'partial', detail: 'CLAUDE.md out of date' } : { status: 'missing' };
}
