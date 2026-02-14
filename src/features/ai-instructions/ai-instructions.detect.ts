import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { fileExists } from 'utils/fs.utils';
import type { FeatureContext } from '../feature.types';
import { AI_INSTRUCTIONS_FILES } from './ai-instructions.constants';

/**
 * Detect if AI Instructions feature is already present in the target directory.
 * Checks for copilot-instructions.md, instructions dir, and .cursor/rules.
 */
export async function detectAiInstructions(context: FeatureContext): Promise<boolean> {
  const [copilotFile, instructionsDir, cursorDir] = AI_INSTRUCTIONS_FILES;
  return (
    fileExists(resolve(context.targetDir, copilotFile))
    && existsSync(resolve(context.targetDir, instructionsDir))
    && existsSync(resolve(context.targetDir, cursorDir))
  );
}
