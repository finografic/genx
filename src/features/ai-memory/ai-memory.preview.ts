import { resolve } from 'node:path';
import { fileExists } from 'utils';
import type { FeaturePreviewResult } from '../../lib/feature-preview/feature-preview.types.js';
import type { FeatureContext } from '../feature.types';

import { previewAiAgents } from '../ai-agents/ai-agents.preview.js';
import { previewAiInstructions } from '../ai-instructions/ai-instructions.preview.js';
import { previewAiMemoryOwnedFiles } from './ai-memory.preview-owned.js';

/**
 * Preview AI Memory: dependency features, owned memory-model files, gitignore, and legacy migrations.
 */
export async function previewAiMemory(context: FeatureContext): Promise<FeaturePreviewResult> {
  const { targetDir } = context;
  const changes: FeaturePreviewResult['changes'] = [];
  const applied: string[] = [];

  const instructionsDir = resolve(targetDir, '.github/instructions');
  if (!fileExists(instructionsDir)) {
    const sub = await previewAiInstructions(context, { skipAgentsInfrastructure: true });
    changes.push(...sub.changes);
    applied.push(...sub.applied);
  }

  const agentsSub = await previewAiAgents(context);
  changes.push(...agentsSub.changes);
  applied.push(...agentsSub.applied);

  const owned = await previewAiMemoryOwnedFiles(context);
  changes.push(...owned.changes);
  applied.push(...owned.applied);

  const noopMessage =
    changes.length === 0
      ? 'Project memory model already matches canonical configuration for owned files.'
      : undefined;

  return { changes, applied, noopMessage };
}
