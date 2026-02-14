import { resolve } from 'node:path';

import { fileExists } from 'utils/fs.utils';
import type { FeatureContext } from '../feature.types';
import { AI_CLAUDE_FILES } from './ai-claude.constants';

/**
 * Detect if AI Claude feature is fully present in the target directory.
 * Checks for CLAUDE.md, .claude/memory.md, and .claude/settings.json.
 */
export async function detectAiClaude(context: FeatureContext): Promise<boolean> {
  return AI_CLAUDE_FILES.every((file) => fileExists(resolve(context.targetDir, file)));
}
