import { resolve } from 'node:path';
import type { AuditResult, FeatureContext } from '../feature.types';

import {
  getChangedPreviewChanges,
  hasPreviewChanges,
} from '../../lib/feature-preview/feature-preview.utils.js';
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

  const agentsMdPath = resolve(context.targetDir, 'AGENTS.md');
  if (!fileExists(agentsMdPath)) return { status: 'missing' };

  // Name the surfaces that actually drifted. Skills became `managed` in the ownership work, so a
  // skill can now be out of date on its own — reporting every drift as "AGENTS.md out of date"
  // would point at the wrong file.
  const changed = getChangedPreviewChanges(preview.changes);
  const surfaces = [
    changed.some((change) => change.path === agentsMdPath) && 'AGENTS.md',
    changed.some((change) => change.path.includes('skills/')) && 'skills',
  ].filter((surface): surface is string => surface !== false);

  return {
    status: 'partial',
    detail: surfaces.length > 0 ? `${surfaces.join(' + ')} out of date` : 'out of date',
  };
}
