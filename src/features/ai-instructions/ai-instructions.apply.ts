import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { copyDir, copyTemplate, errorMessage, fileExists, spinner, successMessage } from 'utils';
import { getTemplatesDir } from 'utils/package-root.utils';
import type { FeatureApplyResult, FeatureContext } from '../feature.types';
import { AI_INSTRUCTIONS_FILES } from './ai-instructions.constants';

/**
 * Apply AI Instructions feature to an existing package.
 * Copies Copilot instructions, GitHub instructions, and Cursor rules from template.
 */
export async function applyAiInstructions(context: FeatureContext): Promise<FeatureApplyResult> {
  const applied: string[] = [];

  const [copilotFile, instructionsDir, cursorDir] = AI_INSTRUCTIONS_FILES;

  const copilotDest = resolve(context.targetDir, copilotFile);
  const instructionsDest = resolve(context.targetDir, instructionsDir);
  const cursorDest = resolve(context.targetDir, cursorDir);

  const copilotExists = fileExists(copilotDest);
  const instructionsExist = existsSync(instructionsDest);
  const cursorExists = existsSync(cursorDest);

  if (copilotExists && instructionsExist && cursorExists) {
    return { applied, noopMessage: 'AI instructions already installed. No changes made.' };
  }

  // Get template directory
  const fromDir = fileURLToPath(new URL('.', import.meta.url));
  const templateDir = getTemplatesDir(fromDir);

  const templateVars = {
    SCOPE: '',
    NAME: '',
    PACKAGE_NAME: '',
    YEAR: new Date().getFullYear().toString(),
    DESCRIPTION: '',
    AUTHOR_NAME: '',
    AUTHOR_EMAIL: '',
  };

  const copySpin = spinner();
  copySpin.start('Copying AI instructions...');

  try {
    // Copy copilot-instructions.md
    if (!copilotExists) {
      await copyTemplate(resolve(templateDir, copilotFile), copilotDest, templateVars);
      applied.push(copilotFile);
    }

    // Copy instructions directory
    if (!instructionsExist) {
      await copyDir(resolve(templateDir, instructionsDir), instructionsDest, templateVars);
      applied.push(instructionsDir);
    }

    // Copy .cursor/rules directory
    if (!cursorExists) {
      await copyDir(resolve(templateDir, cursorDir), cursorDest, templateVars);
      applied.push(cursorDir);
    }

    copySpin.stop('AI instructions copied');

    for (const item of applied) {
      successMessage(`Created ${item}`);
    }
  } catch (err) {
    copySpin.stop('Failed to copy AI instructions');
    const error = err instanceof Error ? err : new Error('Unknown error');
    errorMessage(error.message);
    return { applied, error };
  }

  return { applied };
}
